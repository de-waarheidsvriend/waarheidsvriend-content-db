import * as cheerio from "cheerio";
import type { PrismaClient, Article } from "@prisma/client";
import type {
  XhtmlExport,
  ExtractedArticle,
  ArticleElement,
  ArticleExtractionResult,
  StyleAnalysis,
  LoadedSpread,
  BodyBlock,
} from "@/types";
import {
  cleanHtml,
  htmlToPlainText,
  htmlToSemanticHtml,
  isFooterContent,
  getDominantCharOverride,
} from "./html-cleaner";

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

  // New selectors for cover, intro-verse, verse-reference, and author-bio
  const coverTitleSelector = (styles.coverTitleClasses || []).map((c) => `.${c}`).join(", ");
  const coverChapeauSelector = (styles.coverChapeauClasses || []).map((c) => `.${c}`).join(", ");
  const introVerseSelector = (styles.introVerseClasses || []).map((c) => `.${c}`).join(", ");
  const verseReferenceSelector = (styles.verseReferenceClasses || []).map((c) => `.${c}`).join(", ");
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

    // Check for article end marker (■) - only if this element DIRECTLY contains it
    // (not via child elements, to avoid detecting it multiple times in parent containers)
    const ownText = $el.contents().filter((_, node) => node.type === "text").text();
    if (ownText.includes(ARTICLE_END_MARKER)) {
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
    // Intro verse (meditatie verse text)
    else if (introVerseSelector && $el.is(introVerseSelector)) {
      type = "intro-verse";
    }
    // Verse reference (e.g., "Psalm 57:2b")
    else if (verseReferenceSelector && $el.is(verseReferenceSelector)) {
      type = "verse-reference";
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

    // Add classified elements (InDesign exports in reading order, no sorting needed)
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

  // Note: InDesign exports elements in reading order, so no sorting needed
  // The DOM order already reflects the correct flow across columns

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
 * - Main content ends at ■ marker
 * - After ■, we continue collecting author-bio, author, and streamer elements
 *   (these often appear after ■ in visual order but belong to the article)
 * - Article fully ends at next title or body content after ■
 *
 * Cover elements are skipped as they're handled separately.
 */
function groupElementsIntoArticles(
  elements: ArticleElement[]
): ArticleElement[][] {
  const articles: ArticleElement[][] = [];
  let currentArticle: ArticleElement[] = [];
  let pendingCategory: ArticleElement | null = null;
  let afterEndMarker = false; // Track if we've passed ■

  for (const element of elements) {
    // Skip cover elements - they're handled separately
    if (element.type === "cover-title" || element.type === "cover-chapeau") {
      continue;
    }

    if (element.type === "title") {
      // Title starts a new article
      if (currentArticle.length > 0) {
        // Save previous article
        articles.push(currentArticle);
      }
      // Start new article - include pending category if any
      currentArticle = pendingCategory ? [pendingCategory, element] : [element];
      pendingCategory = null;
      afterEndMarker = false;
    } else if (element.type === "category" && currentArticle.length === 0) {
      // Category before any title - hold it for the next article
      pendingCategory = element;
    } else if (element.type === "article-end") {
      // ■ marker - include it and mark that we're in "trailing" mode
      if (currentArticle.length > 0) {
        currentArticle.push(element);
        afterEndMarker = true;
      }
    } else if (afterEndMarker) {
      // After ■: only collect author-bio, author, and streamer elements
      // These often appear visually below ■ but belong to the article
      if (element.type === "author-bio" || element.type === "author" || element.type === "streamer") {
        currentArticle.push(element);
      } else if (element.type === "body" || element.type === "chapeau" || element.type === "subheading") {
        // Body/chapeau/subheading after ■ means we've moved to next article content
        // Don't include this element, it belongs to the next article
        // (but don't start a new article yet - wait for title)
      }
      // Other element types (image, caption, etc.) after ■ are ignored
    } else {
      // Before ■: all elements belong to current article
      if (currentArticle.length > 0) {
        currentArticle.push(element);
      }
      // If no current article, this is orphan content - skip it
    }
  }

  // Save last article
  if (currentArticle.length > 0) {
    articles.push(currentArticle);
  }

  return articles;
}

/**
 * Merge consecutive body elements into logical paragraphs
 *
 * InDesign single-page exports split logical paragraphs into multiple <p> elements.
 * This function intelligently merges them:
 * - Elements with different CharOverride (styling) are kept separate
 * - Verse-like content (short lines, italic, no sentence-ending punctuation) is merged
 * - Prose paragraphs (ending with . ! ?) stay separate
 *
 * @param elements - Body elements to merge
 * @param defaultCharOverride - The CharOverride class used for normal text
 * @returns Array of merged paragraph strings with HTML formatting preserved
 */
function mergeBodyParagraphs(
  elements: ArticleElement[],
  defaultCharOverride: string | null
): string[] {
  if (elements.length === 0) return [];

  const paragraphs: string[] = [];
  let currentGroup: ArticleElement[] = [];
  let currentOverride: string | null = null;

  for (const el of elements) {
    const override = getDominantCharOverride(el.content);
    const text = htmlToPlainText(el.content);
    const isShortLine = text.length < 80;
    const endsWithSentence = /[.!?:]["']?\s*$/.test(text);

    if (currentGroup.length === 0) {
      // Start new group
      currentGroup.push(el);
      currentOverride = override;
    } else if (override !== currentOverride) {
      // Different styling - finalize current group and start new one
      paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride));
      currentGroup = [el];
      currentOverride = override;
    } else if (override !== defaultCharOverride) {
      // Non-default styling (e.g. italic) - merge into verse
      currentGroup.push(el);
    } else if (isShortLine && !endsWithSentence) {
      // Short line without sentence ending - might be continuation
      currentGroup.push(el);
    } else {
      // Normal prose ending with sentence - finalize and start new
      currentGroup.push(el);
      paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride));
      currentGroup = [];
      currentOverride = null;
    }
  }

  // Finalize last group
  if (currentGroup.length > 0) {
    paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride));
  }

  return paragraphs;
}

/**
 * Finalize a group of elements into paragraph(s)
 */
function finalizeGroup(
  elements: ArticleElement[],
  defaultCharOverride: string | null
): string[] {
  if (elements.length === 0) return [];

  const override = getDominantCharOverride(elements[0].content);
  const isItalic = override !== defaultCharOverride;

  // Convert all elements to semantic HTML
  const texts = elements.map((el) =>
    htmlToSemanticHtml(el.content, defaultCharOverride || undefined)
  );

  if (isItalic) {
    // Italic content (verse) - merge with line breaks
    return [texts.join("\n")];
  }

  // Normal prose - each sentence-ending element is its own paragraph
  // But short lines without sentence endings get merged with the next
  const result: string[] = [];
  let buffer: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const plainText = htmlToPlainText(elements[i].content);
    const endsWithSentence = /[.!?:]["']?\s*$/.test(plainText);

    buffer.push(text);

    if (endsWithSentence || i === texts.length - 1) {
      result.push(buffer.join(" "));
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    result.push(buffer.join(" "));
  }

  return result;
}

/**
 * Build body blocks with streamers and subheadings in correct position
 *
 * Processes content elements in document order, keeping streamers/subheadings
 * as single blocks while merging consecutive body paragraphs.
 * The first paragraph is marked as "intro".
 */
function buildBodyBlocks(
  elements: ArticleElement[],
  defaultCharOverride: string | null
): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let bodyBuffer: ArticleElement[] = [];
  let firstParagraphSeen = false;

  const flushBodyBuffer = () => {
    if (bodyBuffer.length > 0) {
      const paragraphs = mergeBodyParagraphs(bodyBuffer, defaultCharOverride);
      for (const content of paragraphs) {
        // First paragraph becomes "intro", rest are "paragraph"
        const type = !firstParagraphSeen ? "intro" : "paragraph";
        blocks.push({ type, content });
        firstParagraphSeen = true;
      }
      bodyBuffer = [];
    }
  };

  for (const el of elements) {
    if (el.type === "streamer") {
      flushBodyBuffer();
      blocks.push({
        type: "streamer",
        content: htmlToSemanticHtml(el.content, defaultCharOverride || undefined),
      });
    } else if (el.type === "subheading") {
      flushBodyBuffer();
      blocks.push({
        type: "subheading",
        content: htmlToSemanticHtml(el.content, defaultCharOverride || undefined),
      });
    } else if (el.type === "body") {
      bodyBuffer.push(el);
    }
  }

  // Flush remaining body elements
  flushBodyBuffer();

  return blocks;
}

/**
 * Clean and deduplicate author names
 *
 * Handles cases like:
 * - "Tekst: ds. K.H. Bogerd" → "ds. K.H. Bogerd"
 * - Fragments like "Ds.", "K.H.", "Bogerd" (skip short fragments)
 * - Duplicates with different prefixes
 */
function cleanAuthorNames(rawNames: string[]): string[] {
  const cleaned: string[] = [];
  const seenNormalized = new Set<string>();

  for (const raw of rawNames) {
    // Skip very short fragments (likely split text)
    if (raw.length < 5) continue;

    // Remove common prefixes
    let name = raw
      .replace(/^Tekst:\s*/i, "")
      .replace(/^Door:\s*/i, "")
      .replace(/^Auteur:\s*/i, "")
      .trim();

    // Skip if still too short
    if (name.length < 3) continue;

    // Normalize for deduplication (lowercase, no dots/spaces)
    const normalized = name.toLowerCase().replace(/[\s.]/g, "");

    // Skip if we've seen a similar name
    if (seenNormalized.has(normalized)) continue;

    // Check if this is a substring of an existing name or vice versa
    let isDuplicate = false;
    for (const existing of seenNormalized) {
      if (normalized.includes(existing) || existing.includes(normalized)) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    seenNormalized.add(normalized);
    cleaned.push(name);
  }

  return cleaned;
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

  // Extract verse reference for meditaties (e.g., "Psalm 57:2b")
  const verseReferenceElement = elements.find((el) => el.type === "verse-reference");
  const verseReference = verseReferenceElement
    ? htmlToPlainText(verseReferenceElement.content)
    : null;

  // Extract category - first try explicit category element
  const categoryElement = elements.find((el) => el.type === "category");
  let category = categoryElement
    ? htmlToPlainText(categoryElement.content)
    : null;

  // If no explicit category, detect from class name keywords
  if (!category) {
    for (const el of elements) {
      const lowerClass = el.className.toLowerCase();
      if (lowerClass.includes("meditatie")) {
        category = "Meditatie";
        break;
      } else if (lowerClass.includes("column")) {
        category = "Column";
        break;
      }
    }
  }

  // Extract author bio (first author-bio element)
  const authorBioElement = elements.find((el) => el.type === "author-bio");
  const authorBio = authorBioElement
    ? htmlToPlainText(authorBioElement.content)
    : null;

  // Extract author names from author elements (within this article's boundaries)
  const authorElements = elements.filter((el) => el.type === "author");
  const rawAuthorNames = authorElements
    .map((el) => htmlToPlainText(el.content))
    .filter((name) => name.length > 0);

  // Clean and deduplicate author names
  const authorNames = cleanAuthorNames(rawAuthorNames);

  // Get all content elements (body, streamer, subheading) in document order
  const contentElements = elements.filter((el) =>
    el.type === "body" || el.type === "streamer" || el.type === "subheading"
  );

  // Filter out header/footer content from body elements
  const filteredContentElements = contentElements.filter((el) => {
    if (el.type !== "body") return true; // Keep streamers and subheadings
    const text = htmlToPlainText(el.content);
    return !isFooterContent(text);
  });

  // Build HTML content from body elements only (for legacy content field)
  const bodyOnlyElements = filteredContentElements.filter((el) => el.type === "body");
  const bodyHtml = bodyOnlyElements.map((el) => el.content).join("\n");
  const content = cleanHtml(bodyHtml);

  // Detect the default CharOverride (most common across all body elements)
  const allBodyHtml = bodyOnlyElements.map((el) => el.content).join("");
  const defaultCharOverride = getDominantCharOverride(allBodyHtml);

  // Build body paragraphs with streamers/subheadings in correct position
  const bodyParagraphs = buildBodyBlocks(filteredContentElements, defaultCharOverride);

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
    bodyParagraphs,
    content,
    category,
    verseReference,
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
            verse_reference: article.verseReference,
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
