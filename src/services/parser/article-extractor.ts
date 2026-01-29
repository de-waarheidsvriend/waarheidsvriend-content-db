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
 * Extract articles from an XHTML export
 *
 * This is the main entry point for article extraction. It processes all spreads
 * in the export, identifies articles via title elements, and extracts their content.
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

  // Phase 1: Extract elements from all spreads
  for (const spread of xhtmlExport.spreads) {
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

  // Phase 2: Group elements into articles
  const rawArticles = groupElementsIntoArticles(allElements);
  console.log(
    `[Article Extractor] Grouped elements into ${rawArticles.length} raw articles`
  );

  // Phase 3: Detect and merge multi-spread articles
  const mergedArticles = mergeMultiSpreadArticles(rawArticles);
  console.log(
    `[Article Extractor] After merge: ${mergedArticles.length} articles`
  );

  // Phase 4: Build final ExtractedArticle objects
  const articles: ExtractedArticle[] = [];
  for (const articleElements of mergedArticles) {
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
  const categorySelector = styles.categoryClasses
    .map((c) => `.${c}`)
    .join(", ");
  const subheadingSelector = styles.subheadingClasses
    .map((c) => `.${c}`)
    .join(", ");
  const streamerSelector = styles.streamerClasses
    .map((c) => `.${c}`)
    .join(", ");
  const sidebarSelector = styles.sidebarClasses.map((c) => `.${c}`).join(", ");
  const captionSelector = styles.captionClasses.map((c) => `.${c}`).join(", ");

  // Extract all semantic elements in document order (including images)
  $("p, div, span, h1, h2, h3, h4, h5, h6, img").each((_, el) => {
    const $el = $(el);
    const tagName = el.type === "tag" ? el.name.toLowerCase() : "";

    // Handle image elements separately
    if (tagName === "img") {
      const src = $el.attr("src") || "";
      if (src) {
        elements.push({
          type: "image",
          content: src,
          className: "",
          spreadIndex: spread.spreadIndex,
          pageStart: spread.pageStart,
          pageEnd: spread.pageEnd,
        });
      }
      return;
    }

    const className = $el.attr("class") || "";
    const html = $.html(el);
    const text = $el.text().trim();

    // Skip empty elements
    if (!text) return;

    // Determine element type based on class
    // Order matters: more specific patterns should be checked first
    let type: ArticleElement["type"] = "unknown";

    if (subheadingSelector && $el.is(subheadingSelector)) {
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
    } else if (categorySelector && $el.is(categorySelector)) {
      type = "category";
    }

    // Only add elements we can classify
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
  });

  return elements;
}

/**
 * Group extracted elements into articles based on title boundaries
 *
 * Each title element marks the start of a new article. Content elements
 * following a title belong to that article until the next title.
 *
 * Special handling for category elements: if a category appears right before
 * a title (common in magazines), it's associated with the following article.
 */
function groupElementsIntoArticles(
  elements: ArticleElement[]
): ArticleElement[][] {
  const articles: ArticleElement[][] = [];
  let currentArticle: ArticleElement[] = [];
  let pendingCategory: ArticleElement | null = null;

  for (const element of elements) {
    if (element.type === "title") {
      // Title starts a new article
      if (currentArticle.length > 0) {
        articles.push(currentArticle);
      }
      // Start new article - include pending category if any
      currentArticle = pendingCategory ? [pendingCategory, element] : [element];
      pendingCategory = null;
    } else if (element.type === "category" && currentArticle.length === 0) {
      // Category before any title - hold it for the next article
      pendingCategory = element;
    } else {
      // Non-title elements belong to current article (if one exists)
      if (currentArticle.length > 0) {
        currentArticle.push(element);
      }
      // If no current article, this is orphan content (e.g., cover page)
      // We skip orphan content as per edge case handling
    }
  }

  // Don't forget the last article
  if (currentArticle.length > 0) {
    articles.push(currentArticle);
  }

  return articles;
}

/**
 * Detect and merge articles that span multiple spreads
 *
 * Heuristics:
 * 1. Article ends with body text that doesn't end with sentence-ending punctuation
 * 2. Next article on following spread starts with body (no title)
 * 3. Spreads are consecutive
 */
function mergeMultiSpreadArticles(
  articles: ArticleElement[][]
): ArticleElement[][] {
  if (articles.length <= 1) {
    return articles;
  }

  const merged: ArticleElement[][] = [];
  let i = 0;

  while (i < articles.length) {
    const current = articles[i];
    const mergedArticle = [...current];

    // Check if this article should be merged with following articles
    while (i + 1 < articles.length) {
      const next = articles[i + 1];

      if (shouldMergeArticles(mergedArticle, next)) {
        // Merge: add all elements from next except its title (if it has one)
        // Actually, if shouldMerge is true, next shouldn't have a title
        mergedArticle.push(...next);
        i++;
      } else {
        break;
      }
    }

    merged.push(mergedArticle);
    i++;
  }

  return merged;
}

/**
 * Determine if two article element groups should be merged
 */
function shouldMergeArticles(
  current: ArticleElement[],
  next: ArticleElement[]
): boolean {
  if (current.length === 0 || next.length === 0) {
    return false;
  }

  // Check if next article has a title - if yes, it's a separate article
  const nextHasTitle = next.some((el) => el.type === "title");
  if (nextHasTitle) {
    return false;
  }

  // Get the last spread index of current article
  const currentLastSpread = Math.max(...current.map((el) => el.spreadIndex));
  // Get the first spread index of next article
  const nextFirstSpread = Math.min(...next.map((el) => el.spreadIndex));

  // Spreads should be consecutive (or same spread for multi-column)
  if (nextFirstSpread - currentLastSpread > 1) {
    return false;
  }

  // Check if current article ends with incomplete text
  const lastBodyElement = [...current]
    .reverse()
    .find((el) => el.type === "body");
  if (lastBodyElement) {
    const text = htmlToPlainText(lastBodyElement.content).trim();

    // If text ends with sentence-ending punctuation, article is likely complete
    // Include ":" and "-" as valid endings (common in Dutch lists/enumerations)
    if ([".", "!", "?", '"', "'", "»", ":", "-"].some((p) => text.endsWith(p))) {
      // But still merge if next spread has only body content (continuation indicator)
      const nextOnlyBody = next.every(
        (el) => el.type === "body" || el.type === "image"
      );
      return nextOnlyBody && nextFirstSpread === currentLastSpread + 1;
    }

    // Text doesn't end with punctuation - likely continues
    return true;
  }

  return false;
}

/**
 * Build an ExtractedArticle from grouped elements
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

  // Extract chapeau (first chapeau element)
  const chapeauElement = elements.find((el) => el.type === "chapeau");
  const chapeau = chapeauElement
    ? htmlToPlainText(chapeauElement.content)
    : null;

  // Extract category (first category element)
  const categoryElement = elements.find((el) => el.type === "category");
  const category = categoryElement
    ? htmlToPlainText(categoryElement.content)
    : null;

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
  const sourceSpreadIndexes = [...new Set(elements.map((el) => el.spreadIndex))];

  // Collect referenced images
  const imageElements = elements.filter((el) => el.type === "image");
  const referencedImages = imageElements.map((el) => {
    // Extract filename from src path
    const src = el.content;
    const parts = src.split("/");
    return parts[parts.length - 1];
  });

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
    pageStart,
    pageEnd,
    sourceSpreadIndexes,
    referencedImages,
    subheadings,
    streamers,
    sidebars,
    captions,
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
