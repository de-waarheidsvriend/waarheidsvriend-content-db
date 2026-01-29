import * as cheerio from "cheerio";
import type { PrismaClient, Article } from "@prisma/client";
import type {
  XhtmlExport,
  ExtractedArticle,
  ArticleElement,
  ArticleExtractionResult,
  StyleAnalysis,
  LoadedSpread,
} from "@/types";
import { cleanHtml, generateExcerpt, htmlToPlainText } from "./html-cleaner";

/**
 * The article end marker character used by InDesign exports
 */
const ARTICLE_END_MARKER = "■";

/**
 * Extract articles from an XHTML export
 *
 * This is the main entry point for article extraction. It processes all spreads
 * in the export, identifies articles via title→■ boundaries, and extracts their content.
 *
 * @param xhtmlExport - The loaded XHTML export from loadXhtmlExport()
 * @returns Array of extracted articles and any errors encountered
 */
export async function extractArticles(
  xhtmlExport: XhtmlExport
): Promise<ArticleExtractionResult> {
  const errors: string[] = [];
  const allElements: ArticleElement[] = [];

  console.log(
    `[Article Extractor] Processing ${xhtmlExport.spreads.length} spreads`
  );

  // Phase 1: Extract elements from all spreads (skip cover page = spreadIndex 0)
  for (const spread of xhtmlExport.spreads) {
    // Skip cover page - cover content is handled separately
    if (spread.spreadIndex === 0) {
      console.log("[Article Extractor] Skipping cover page (spreadIndex 0)");
      continue;
    }

    try {
      const elements = extractElementsFromSpread(spread, xhtmlExport.styles);
      allElements.push(...elements);
    } catch (error) {
      const errorMsg = `Failed to extract elements from spread ${spread.spreadIndex}: ${error}`;
      errors.push(errorMsg);
      console.error(`[Article Extractor] ${errorMsg}`);
    }
  }

  console.log(
    `[Article Extractor] Extracted ${allElements.length} elements from spreads`
  );

  // Count article-end markers for verification
  const endMarkerCount = allElements.filter(
    (el) => el.type === "article-end"
  ).length;
  console.log(
    `[Article Extractor] Found ${endMarkerCount} article end markers (■)`
  );

  // Phase 2: Group elements into articles using title→■ boundaries
  const rawArticles = groupElementsIntoArticles(allElements);
  console.log(
    `[Article Extractor] Grouped elements into ${rawArticles.length} articles`
  );

  // Phase 3: Build final ExtractedArticle objects
  const articles: ExtractedArticle[] = [];
  for (const articleElements of rawArticles) {
    try {
      const article = buildExtractedArticle(articleElements);
      if (article) {
        articles.push(article);
      }
    } catch (error) {
      const errorMsg = `Failed to build article: ${error}`;
      errors.push(errorMsg);
      console.error(`[Article Extractor] ${errorMsg}`);
    }
  }

  console.log(
    `[Article Extractor] Extraction complete: ${articles.length} articles, ${errors.length} errors`
  );

  return { articles, errors };
}

/**
 * Extract article elements from a single spread
 *
 * Detects the ■ character as article-end marker and classifies elements
 * based on their CSS classes.
 */
function extractElementsFromSpread(
  spread: LoadedSpread,
  styles: StyleAnalysis
): ArticleElement[] {
  const elements: ArticleElement[] = [];
  const $ = cheerio.load(spread.html);

  // Build CSS selectors for each element type
  const titleSelector = styles.titleClasses.map((c) => `.${c}`).join(", ");
  const chapeauSelector = styles.chapeauClasses.map((c) => `.${c}`).join(", ");
  const bodySelector = styles.bodyClasses.map((c) => `.${c}`).join(", ");
  const authorSelector = styles.authorClasses.map((c) => `.${c}`).join(", ");
  const categorySelector = styles.categoryClasses.map((c) => `.${c}`).join(", ");
  const subheadingSelector = styles.subheadingClasses.map((c) => `.${c}`).join(", ");
  const streamerSelector = styles.streamerClasses.map((c) => `.${c}`).join(", ");
  const sidebarSelector = styles.sidebarClasses.map((c) => `.${c}`).join(", ");
  const captionSelector = styles.captionClasses.map((c) => `.${c}`).join(", ");

  // New selectors for cover, intro-verse, and author-bio
  const coverTitleSelector = (styles.coverTitleClasses || []).map((c) => `.${c}`).join(", ");
  const coverChapeauSelector = (styles.coverChapeauClasses || []).map((c) => `.${c}`).join(", ");
  const introVerseSelector = (styles.introVerseClasses || []).map((c) => `.${c}`).join(", ");
  const authorBioSelector = (styles.authorBioClasses || []).map((c) => `.${c}`).join(", ");

  // Track author elements for author photo detection
  let lastAuthorElementIndex = -1;
  const authorPhotoFilenames = new Set<string>();
  let elementIndex = 0;

  // Extract all semantic elements in document order (including images)
  $("p, div, span, h1, h2, h3, h4, h5, h6, img").each((_, el) => {
    const $el = $(el);
    const tagName = el.type === "tag" ? el.name.toLowerCase() : "";

    // Handle image elements separately
    if (tagName === "img") {
      const src = $el.attr("src") || "";
      if (src && !src.startsWith("data:")) {
        // Check if this image is likely an author photo (within 2 elements of author block)
        const filename = src.split("/").pop() || "";
        if (
          lastAuthorElementIndex >= 0 &&
          elementIndex - lastAuthorElementIndex <= 2
        ) {
          authorPhotoFilenames.add(filename);
        }

        elements.push({
          type: "image",
          content: src,
          className: "",
          spreadIndex: spread.spreadIndex,
          pageStart: spread.pageStart,
          pageEnd: spread.pageEnd,
        });
      }
      elementIndex++;
      return;
    }

    const className = $el.attr("class") || "";
    const html = $.html(el);
    const text = $el.text().trim();

    // Check for article end marker (■) in any element
    if (text.includes(ARTICLE_END_MARKER)) {
      elements.push({
        type: "article-end",
        content: ARTICLE_END_MARKER,
        className,
        spreadIndex: spread.spreadIndex,
        pageStart: spread.pageStart,
        pageEnd: spread.pageEnd,
      });
      elementIndex++;
      return;
    }

    // Skip empty elements
    if (!text) {
      elementIndex++;
      return;
    }

    // Determine element type based on class
    // Order matters: more specific patterns should be checked first
    let type: ArticleElement["type"] = "unknown";

    // Cover elements first (should be skipped for article extraction)
    if (coverTitleSelector && $el.is(coverTitleSelector)) {
      type = "cover-title";
    } else if (coverChapeauSelector && $el.is(coverChapeauSelector)) {
      type = "cover-chapeau";
    }
    // Intro verse (meditatie verse)
    else if (introVerseSelector && $el.is(introVerseSelector)) {
      type = "intro-verse";
    }
    // Author bio (onderschrift-auteur paragraph)
    else if (authorBioSelector && $el.is(authorBioSelector)) {
      type = "author-bio";
    }
    // Standard element types
    else if (subheadingSelector && $el.is(subheadingSelector)) {
      type = "subheading";
    } else if (streamerSelector && $el.is(streamerSelector)) {
      type = "streamer";
    } else if (sidebarSelector && $el.is(sidebarSelector)) {
      type = "sidebar";
    } else if (captionSelector && $el.is(captionSelector)) {
      type = "caption";
    } else if (titleSelector && $el.is(titleSelector)) {
      type = "title";
    } else if (chapeauSelector && $el.is(chapeauSelector)) {
      type = "chapeau";
    } else if (bodySelector && $el.is(bodySelector)) {
      type = "body";
    } else if (authorSelector && $el.is(authorSelector)) {
      type = "author";
      lastAuthorElementIndex = elementIndex;
    } else if (categorySelector && $el.is(categorySelector)) {
      type = "category";
    }

    // Add classified elements
    if (type !== "unknown") {
      elements.push({
        type,
        content: html,
        className,
        spreadIndex: spread.spreadIndex,
        pageStart: spread.pageStart,
        pageEnd: spread.pageEnd,
      });
    }

    elementIndex++;
  });

  // Store author photo filenames for later use in the spread context
  // We'll pass these through the element content for now
  if (authorPhotoFilenames.size > 0) {
    console.log(
      `[Article Extractor] Identified ${authorPhotoFilenames.size} potential author photos on spread ${spread.spreadIndex}`
    );
  }

  return elements;
}

/**
 * Group extracted elements into articles using title→■ boundaries
 *
 * Article structure:
 * - Starts at a title element
 * - Ends at ■ (article-end marker)
 * - Everything between belongs to that article (chapeau, body, author, images, etc.)
 *
 * Cover elements are skipped as they're handled separately.
 */
function groupElementsIntoArticles(
  elements: ArticleElement[]
): ArticleElement[][] {
  const articles: ArticleElement[][] = [];
  let currentArticle: ArticleElement[] = [];
  let pendingCategory: ArticleElement | null = null;

  for (const element of elements) {
    // Skip cover elements - they're handled separately
    if (element.type === "cover-title" || element.type === "cover-chapeau") {
      continue;
    }

    if (element.type === "title") {
      // Title starts a new article
      if (currentArticle.length > 0) {
        // Previous article didn't end with ■ - still save it
        console.warn(
          "[Article Extractor] Article ended without ■ marker, saving anyway"
        );
        articles.push(currentArticle);
      }
      // Start new article - include pending category if any
      currentArticle = pendingCategory ? [pendingCategory, element] : [element];
      pendingCategory = null;
    } else if (element.type === "article-end") {
      // ■ ends current article
      if (currentArticle.length > 0) {
        articles.push(currentArticle);
        currentArticle = [];
      }
      pendingCategory = null;
    } else if (element.type === "category" && currentArticle.length === 0) {
      // Category before any title - hold it for the next article
      pendingCategory = element;
    } else {
      // All other elements belong to current article (if one exists)
      if (currentArticle.length > 0) {
        currentArticle.push(element);
      }
      // If no current article, this is orphan content - skip it
    }
  }

  // Handle last article if no ■ found (shouldn't happen normally)
  if (currentArticle.length > 0) {
    console.warn(
      "[Article Extractor] Last article ended without ■ marker, saving anyway"
    );
    articles.push(currentArticle);
  }

  return articles;
}

/**
 * Build an ExtractedArticle from grouped elements
 *
 * With title→■ boundaries, all elements between are guaranteed to belong
 * to this article. No proximity checks needed.
 */
function buildExtractedArticle(
  elements: ArticleElement[]
): ExtractedArticle | null {
  // Must have at least a title
  const titleElement = elements.find((el) => el.type === "title");
  if (!titleElement) {
    return null;
  }

  // Extract title text
  const title = htmlToPlainText(titleElement.content);
  if (!title) {
    return null;
  }

  // Extract chapeau - can be chapeau class OR intro-verse (meditatie verse)
  const chapeauElement = elements.find(
    (el) => el.type === "chapeau" || el.type === "intro-verse"
  );
  const chapeau = chapeauElement
    ? htmlToPlainText(chapeauElement.content)
    : null;

  // Extract category (first category element)
  const categoryElement = elements.find((el) => el.type === "category");
  const category = categoryElement
    ? htmlToPlainText(categoryElement.content)
    : null;

  // Extract author bio (first author-bio element)
  const authorBioElement = elements.find((el) => el.type === "author-bio");
  const authorBio = authorBioElement
    ? htmlToPlainText(authorBioElement.content)
    : null;

  // Extract author names from author elements (within this article's boundaries)
  const authorElements = elements.filter((el) => el.type === "author");
  const authorNames = authorElements
    .map((el) => htmlToPlainText(el.content))
    .filter((name) => name.length > 0);

  // Combine all body elements into content
  const bodyElements = elements.filter((el) => el.type === "body");
  const bodyHtml = bodyElements.map((el) => el.content).join("\n");
  const content = cleanHtml(bodyHtml);

  // Generate excerpt from content
  const excerpt = content ? generateExcerpt(content, 150) : null;

  // Calculate page range
  const pageStarts = elements.map((el) => el.pageStart);
  const pageEnds = elements.map((el) => el.pageEnd);
  const pageStart = Math.min(...pageStarts);
  const pageEnd = Math.max(...pageEnds);

  // Collect source spread indexes
  const sourceSpreadIndexes = [
    ...new Set(elements.map((el) => el.spreadIndex)),
  ];

  // Collect referenced images
  const imageElements = elements.filter((el) => el.type === "image");
  const referencedImages = imageElements.map((el) => {
    // Extract filename from src path
    const src = el.content;
    const parts = src.split("/");
    return parts[parts.length - 1];
  });

  // Identify author photos based on DOM position (images after author blocks)
  // We mark these for filtering in the image-mapper
  const authorPhotoFilenames = new Set<string>();
  let lastAuthorIndex = -1;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === "author" || el.type === "author-bio") {
      lastAuthorIndex = i;
    } else if (el.type === "image" && lastAuthorIndex >= 0 && i - lastAuthorIndex <= 2) {
      const filename = el.content.split("/").pop() || "";
      if (filename) {
        authorPhotoFilenames.add(filename);
      }
    }
  }

  // Extract subheadings (FR20)
  const subheadingElements = elements.filter((el) => el.type === "subheading");
  const subheadings = subheadingElements.map((el) =>
    htmlToPlainText(el.content)
  );

  // Extract streamers/quotes (FR21)
  const streamerElements = elements.filter((el) => el.type === "streamer");
  const streamers = streamerElements.map((el) => htmlToPlainText(el.content));

  // Extract sidebar/kader blocks (FR19) - keep as cleaned HTML
  const sidebarElements = elements.filter((el) => el.type === "sidebar");
  const sidebars = sidebarElements.map((el) => cleanHtml(el.content));

  // Extract captions and try to associate with images
  // Captions typically appear near images in the document
  const captionElements = elements.filter((el) => el.type === "caption");
  const captions = new Map<string, string>();

  // Simple heuristic: match captions to images by position
  // For each caption, find the nearest preceding image
  for (let i = 0; i < captionElements.length; i++) {
    const captionText = htmlToPlainText(captionElements[i].content);
    // Find the image element that this caption likely belongs to
    // by looking at elements before the caption
    const captionIndex = elements.indexOf(captionElements[i]);
    for (let j = captionIndex - 1; j >= 0; j--) {
      if (elements[j].type === "image") {
        const imageSrc = elements[j].content;
        const parts = imageSrc.split("/");
        const filename = parts[parts.length - 1];
        // Only set if not already set (first caption wins)
        if (!captions.has(filename)) {
          captions.set(filename, captionText);
        }
        break;
      }
    }
  }

  return {
    title,
    chapeau,
    content,
    excerpt,
    category,
    authorBio,
    pageStart,
    pageEnd,
    sourceSpreadIndexes,
    referencedImages,
    subheadings,
    streamers,
    sidebars,
    captions,
    authorNames,
    authorPhotoFilenames,
  };
}

/**
 * Result of saving articles to the database
 */
export interface SaveArticlesResult {
  articles: Article[];
  errors: string[];
}

/**
 * Save extracted articles to the database
 *
 * @param prisma - Prisma client instance
 * @param editionId - The ID of the edition to associate articles with
 * @param articles - Array of extracted articles to save
 * @returns Object with created Article records and any errors encountered
 */
export async function saveArticles(
  prisma: PrismaClient,
  editionId: number,
  articles: ExtractedArticle[]
): Promise<SaveArticlesResult> {
  const errors: string[] = [];

  console.log(
    `[Article Extractor] Saving ${articles.length} articles for edition ${editionId}`
  );

  if (articles.length === 0) {
    return { articles: [], errors: [] };
  }

  try {
    // Use createMany for bulk insert efficiency
    // Note: Prisma's createMany doesn't return created records, so we use a transaction
    const createdArticles = await prisma.$transaction(
      articles.map((article) =>
        prisma.article.create({
          data: {
            edition_id: editionId,
            title: article.title,
            chapeau: article.chapeau,
            content: article.content,
            excerpt: article.excerpt,
            category: article.category,
            author_bio: article.authorBio,
            page_start: article.pageStart,
            page_end: article.pageEnd,
          },
        })
      )
    );

    console.log(
      `[Article Extractor] Successfully saved ${createdArticles.length} articles`
    );

    return { articles: createdArticles, errors: [] };
  } catch (error) {
    const errorMsg = `Failed to save articles for edition ${editionId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Article Extractor] ${errorMsg}`);
    errors.push(errorMsg);
    return { articles: [], errors };
  }
}
