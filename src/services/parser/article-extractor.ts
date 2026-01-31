import * as cheerio from "cheerio";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
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
  getYRange,
  parseCharOverrideStyles,
  type CharOverrideStyles,
} from "./html-cleaner";

/**
 * The article end marker character used by InDesign exports
 */
const ARTICLE_END_MARKER = "■";

/**
 * Find the CSS directory in an XHTML export
 * Handles both direct structure and nested folder structure
 */
async function findCssDir(xhtmlDir: string): Promise<string | null> {
  // First, try the direct path
  const directPath = join(xhtmlDir, "publication-web-resources", "css");
  try {
    await readdir(directPath);
    return directPath;
  } catch {
    // Not found directly, look for a content subfolder
  }

  // Look for a content subfolder (excluding __MACOSX)
  try {
    const entries = await readdir(xhtmlDir);
    for (const entry of entries) {
      if (entry === "__MACOSX" || String(entry).startsWith(".")) continue;
      const subPath = join(
        xhtmlDir,
        String(entry),
        "publication-web-resources",
        "css"
      );
      try {
        await readdir(subPath);
        return subPath;
      } catch {
        // This subfolder doesn't have the expected structure
      }
    }
  } catch {
    // xhtmlDir doesn't exist or isn't readable
  }

  return null;
}

/**
 * Load and parse CharOverride styles from CSS files in the XHTML export
 *
 * @param xhtmlDir - Root directory of the XHTML export
 * @returns Map of CharOverride class name to styling information, or null if CSS not found
 */
async function loadCharOverrideStyles(xhtmlDir: string): Promise<Map<string, CharOverrideStyles> | null> {
  const cssDir = await findCssDir(xhtmlDir);
  if (!cssDir) {
    console.warn("[Article Extractor] Could not find CSS directory");
    return null;
  }

  try {
    const files = await readdir(cssDir);
    let allStyles = new Map<string, CharOverrideStyles>();

    for (const file of files) {
      const fileName = typeof file === "string" ? file : String(file);
      if (!fileName.endsWith(".css")) continue;

      const content = await readFile(join(cssDir, fileName), "utf-8");
      const styles = parseCharOverrideStyles(content);

      // Merge styles from all CSS files
      for (const [className, style] of styles) {
        allStyles.set(className, style);
      }
    }

    console.log(`[Article Extractor] Loaded ${allStyles.size} CharOverride styles from CSS`);
    return allStyles;
  } catch (error) {
    console.warn(`[Article Extractor] Failed to load CSS: ${error}`);
    return null;
  }
}

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

  // Load CharOverride styles from CSS for bold/italic detection
  const charOverrideStyles = await loadCharOverrideStyles(xhtmlExport.rootDir);

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
      const article = buildExtractedArticle(articleElements, charOverrideStyles);
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
  const questionSelector = (styles.questionClasses || []).map((c) => `.${c}`).join(", ");

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
    // Question must be checked before subheading (question classes contain "tussenkop")
    else if (questionSelector && $el.is(questionSelector)) {
      type = "question";
    } else if (subheadingSelector && $el.is(subheadingSelector)) {
      type = "subheading";
    } else if (streamerSelector && $el.is(streamerSelector)) {
      type = "streamer";
    } else if (sidebarSelector && $el.is(sidebarSelector) && tagName !== "div") {
      // Only match p elements for sidebar - div containers like Basisafbeeldingskader
      // contain child p elements that have the actual content
      type = "sidebar";
    } else if (captionSelector && $el.is(captionSelector)) {
      type = "caption";
    } else if (titleSelector && $el.is(titleSelector)) {
      type = "title";
    } else if (chapeauSelector && $el.is(chapeauSelector)) {
      type = "chapeau";
    } else if (bodySelector && $el.is(bodySelector) && tagName !== "div") {
      // Only match p elements for body - div containers like Basistekstkader
      // contain child p elements that have the actual content
      type = "body";
    } else if (authorSelector && $el.is(authorSelector)) {
      type = "author";
      lastAuthorElementIndex = elementIndex;
    } else if (categorySelector && $el.is(categorySelector)) {
      type = "category";
    }

    // Add classified elements (InDesign exports in reading order, no sorting needed)
    if (type !== "unknown") {
      // Extract Y-positions for paragraph gap detection
      const yRange = getYRange(html);

      elements.push({
        type,
        content: html,
        className,
        spreadIndex: spread.spreadIndex,
        pageStart: spread.pageStart,
        pageEnd: spread.pageEnd,
        yStart: yRange?.yStart,
        yEnd: yRange?.yEnd,
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
 * Check if a title indicates an "In memoriam" article
 */
function isInMemoriamTitle(content: string): boolean {
  const text = htmlToPlainText(content).toLowerCase();
  return text.includes("in memoriam");
}

/**
 * Check if a title looks like a lifespan (e.g., "1938-2026")
 */
function isLifespanTitle(content: string): boolean {
  const text = htmlToPlainText(content);
  // Match patterns like "1938-2026", "1938 - 2026", "1938–2026"
  return /^\d{4}\s*[-–]\s*\d{4}$/.test(text.trim());
}

/**
 * Check if current article has substantial body content
 */
function hasBodyContent(elements: ArticleElement[]): boolean {
  return elements.some((el) => el.type === "body" || el.type === "chapeau");
}

/**
 * Check if the last semantic content in the article is a chapeau
 * (ignoring author/image elements which can appear at the end)
 * This indicates a potential new article start
 */
function lastContentIsChapeau(elements: ArticleElement[]): boolean {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    // Skip non-content elements
    if (el.type === "author" || el.type === "author-bio" || el.type === "image") {
      continue;
    }
    // Found content - check if it's a chapeau
    return el.type === "chapeau";
  }
  return false;
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
 * Special handling for "In memoriam" articles:
 * - "In memoriam" + name + lifespan are grouped as one article
 * - "In memoriam" becomes the category, name becomes title, lifespan is extracted
 *
 * Cover elements are skipped as they're handled separately.
 */
function groupElementsIntoArticles(
  elements: ArticleElement[]
): ArticleElement[][] {
  const articles: ArticleElement[][] = [];
  let currentArticle: ArticleElement[] = [];
  let pendingCategory: ArticleElement | null = null;
  let inMemoriamMode = false; // Track if we're in an "In memoriam" compound title
  let articleComplete = false; // Track if we've seen the ■ marker
  let endMarkerPage = -1; // Page where ■ was found (for trailing author-bio)
  let awaitingTitle = false; // Track if we're collecting pre-title elements after ■

  for (const element of elements) {
    // Skip cover elements - they're handled separately
    if (element.type === "cover-title" || element.type === "cover-chapeau") {
      continue;
    }

    if (element.type === "title") {
      const titleText = htmlToPlainText(element.content);

      // Check if last saved article has no title and is on same/adjacent page
      // This handles cases where body+■ comes before title in DOM order (e.g., columns)
      if (articleComplete && articles.length > 0) {
        const lastArticle = articles[articles.length - 1];
        const lastArticleHasTitle = lastArticle.some(el => el.type === "title");
        const lastArticlePage = lastArticle[0]?.pageStart;

        if (!lastArticleHasTitle && Math.abs(element.pageStart - lastArticlePage) <= 1) {
          // Add title to the last article (body came before title in DOM)
          // The article already has ■ so it's complete - just add the title and leave it saved
          lastArticle.unshift(element); // Add at beginning
          // Reset state for next article
          currentArticle = [];
          articleComplete = false;
          awaitingTitle = false;
          endMarkerPage = -1;
          pendingCategory = null;
          continue;
        }
      }

      // Check if this is the start of an "In memoriam" article
      if (isInMemoriamTitle(element.content)) {
        // Start new "In memoriam" article
        if (currentArticle.length > 0 && !awaitingTitle) {
          articles.push(currentArticle);
        }
        // Include any pre-title elements collected after ■
        if (awaitingTitle) {
          currentArticle = pendingCategory
            ? [pendingCategory, ...currentArticle, element]
            : [...currentArticle, element];
        } else {
          currentArticle = pendingCategory ? [pendingCategory, element] : [element];
        }
        pendingCategory = null;
        inMemoriamMode = true; // Enable compound title mode
        articleComplete = false;
        awaitingTitle = false;
        endMarkerPage = -1;
      }
      // Check if we're continuing an "In memoriam" compound title
      else if (inMemoriamMode && !hasBodyContent(currentArticle)) {
        // This is the name or lifespan part of "In memoriam"
        currentArticle.push(element);
        // If this is a lifespan, we're done with compound title mode
        if (isLifespanTitle(element.content)) {
          inMemoriamMode = false;
        }
      }
      // Normal title
      else {
        // Check if currentArticle has content but no title yet (body before title case)
        const currentArticleHasTitle = currentArticle.some(el => el.type === "title");

        // Start new article if:
        // 1. No current article yet
        // 2. Previous article is complete (■ marker seen, waiting for trailing elements)
        // 3. We're collecting pre-title elements after ■ (chapeau, category, etc.)
        // 4. Current article has content but no title yet (body appeared before title)
        if (currentArticle.length === 0 || articleComplete || awaitingTitle || !currentArticleHasTitle) {
          if (currentArticle.length > 0 && !awaitingTitle && currentArticleHasTitle) {
            // Only save if we're not awaiting a title AND current already has a title
            articles.push(currentArticle);
            currentArticle = [];
          }
          // Start new article with any pre-title elements (chapeau, etc.) plus this title
          // Or add title to existing pre-title content
          if (pendingCategory) {
            currentArticle = [pendingCategory, ...currentArticle, element];
            pendingCategory = null;
          } else if (currentArticle.length > 0 && !currentArticleHasTitle) {
            // Add title at the beginning of existing content
            currentArticle.unshift(element);
          } else {
            currentArticle.push(element);
          }
          articleComplete = false;
          awaitingTitle = false;
          endMarkerPage = -1;
        } else {
          // Article already has a title and no ■ marker yet - treat as subtitle
          currentArticle.push(element);
        }
        inMemoriamMode = false;
      }
    } else if (element.type === "category" && currentArticle.length === 0) {
      // Category before any title - hold it for the next article
      pendingCategory = element;
    } else if (element.type === "article-end") {
      // ■ marker - save article immediately so currentArticle is ready for next article
      if (currentArticle.length > 0) {
        currentArticle.push(element);
        articles.push(currentArticle);  // Save immediately
        currentArticle = [];            // Reset for next article
        inMemoriamMode = false;
        articleComplete = true;
        endMarkerPage = element.pageStart; // Remember page for trailing author-bio
      }
    } else if (articleComplete) {
      // After ■: author-related elements, images, streamers, and sidebars on the SAME PAGE go to the LAST saved article
      // (these elements often appear visually below ■ but belong to the article)
      if (
        (element.type === "author-bio" || element.type === "author" || element.type === "image" ||
         element.type === "streamer" || element.type === "sidebar") &&
        element.pageStart === endMarkerPage
      ) {
        // Add to the last saved article
        articles[articles.length - 1].push(element);
      } else {
        // All other elements: start collecting for next article
        // Mark that we're awaiting a title to properly start the article
        articleComplete = false;
        awaitingTitle = true;
        currentArticle.push(element);
      }
    } else {
      // Before ■: all elements belong to current article
      if (currentArticle.length > 0) {
        currentArticle.push(element);
        // Once we have body content, exit compound title mode
        if (element.type === "body" || element.type === "chapeau") {
          inMemoriamMode = false;
        }
      } else if (
        element.type === "body" ||
        element.type === "chapeau" ||
        element.type === "author-bio" ||
        element.type === "subheading" ||
        element.type === "streamer"
      ) {
        // Content before title - start article anyway (handles columns where body comes before title)
        // Include any pending category
        if (pendingCategory) {
          currentArticle.push(pendingCategory);
          pendingCategory = null;
        }
        currentArticle.push(element);
      }
      // If no current article and not content, this is orphan content - skip it
    }
  }

  // Save last article
  if (currentArticle.length > 0) {
    articles.push(currentArticle);
  }

  return articles;
}

/**
 * Threshold for Y-gap between paragraphs (in pixels)
 * - Gap <= threshold: same paragraph (merge with line break)
 * - Gap > threshold: new paragraph (separate block)
 *
 * Typical InDesign line height is ~250px, paragraph gap is ~400-500px
 */
const GAP_THRESHOLD = 350;

/**
 * Check if a new paragraph should start based on Y-gap
 */
function shouldStartNewParagraph(
  prevElement: ArticleElement,
  currElement: ArticleElement
): boolean {
  // If no Y-positions available, use default behavior (separate paragraphs)
  if (prevElement.yEnd === undefined || currElement.yStart === undefined) {
    return true;
  }
  const gap = currElement.yStart - prevElement.yEnd;
  return gap > GAP_THRESHOLD;
}

/**
 * Merge consecutive body elements into logical paragraphs based on Y-gap
 *
 * InDesign single-page exports split logical paragraphs into multiple <p> elements.
 * This function uses Y-position gaps to determine paragraph boundaries:
 * - Small gap (<=350px): Same paragraph, merge with line break
 * - Large gap (>350px): New paragraph (visual whitespace in source)
 *
 * Elements with different CharOverride (styling) are always kept separate.
 *
 * @param elements - Body elements to merge
 * @param defaultCharOverride - The CharOverride class used for normal text
 * @returns Array of merged paragraph strings with HTML formatting preserved
 */
function mergeBodyParagraphs(
  elements: ArticleElement[],
  defaultCharOverride: string | null,
  charOverrideStyles?: Map<string, CharOverrideStyles> | null
): string[] {
  if (elements.length === 0) return [];

  const paragraphs: string[] = [];
  let currentGroup: ArticleElement[] = [];
  let currentOverride: string | null = null;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const override = getDominantCharOverride(el.content);

    if (currentGroup.length === 0) {
      // Start new group
      currentGroup.push(el);
      currentOverride = override;
    } else if (override !== currentOverride) {
      // Different styling - finalize current group and start new one
      paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride, charOverrideStyles));
      currentGroup = [el];
      currentOverride = override;
    } else {
      // Same styling - check Y-gap
      const prevEl = currentGroup[currentGroup.length - 1];
      if (shouldStartNewParagraph(prevEl, el)) {
        // Large gap - finalize current group and start new one
        paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride, charOverrideStyles));
        currentGroup = [el];
      } else {
        // Small gap - continue current group (will be merged with line break)
        currentGroup.push(el);
      }
    }
  }

  // Finalize last group
  if (currentGroup.length > 0) {
    paragraphs.push(...finalizeGroup(currentGroup, defaultCharOverride, charOverrideStyles));
  }

  return paragraphs;
}

/**
 * Finalize a group of elements into a single paragraph
 *
 * Elements in a group have small Y-gaps and should be merged.
 * For italic content (verses), line breaks are preserved between elements.
 * For prose, line breaks are removed (they come from column widths in print).
 */
function finalizeGroup(
  elements: ArticleElement[],
  defaultCharOverride: string | null,
  charOverrideStyles?: Map<string, CharOverrideStyles> | null
): string[] {
  if (elements.length === 0) return [];

  const override = getDominantCharOverride(elements[0].content);
  const isItalic = override !== null && override !== defaultCharOverride;

  // Convert all elements to semantic HTML
  const texts = elements.map((el) =>
    htmlToSemanticHtml(el.content, defaultCharOverride || undefined, charOverrideStyles || undefined)
  );

  if (isItalic) {
    // Verse: preserve line breaks per regel
    return [texts.join("\n")];
  }

  // Prose: join with spaces, remove internal line breaks
  const joined = texts.join(" ");
  return [joined.replace(/\n/g, " ").replace(/\s+/g, " ").trim()];
}

/**
 * Build body blocks with streamers and subheadings in correct position
 *
 * Processes content elements in document order, keeping streamers/subheadings
 * as single blocks while merging consecutive body paragraphs.
 * The first paragraph is marked as "intro".
 * Sidebars (and their preceding titles) are collected and appended at the end
 * to avoid interrupting the flow of body text.
 */
function buildBodyBlocks(
  elements: ArticleElement[],
  defaultCharOverride: string | null,
  charOverrideStyles?: Map<string, CharOverrideStyles> | null
): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const sidebars: BodyBlock[] = []; // Collect sidebars to append at end
  let bodyBuffer: ArticleElement[] = [];
  let sidebarBuffer: ArticleElement[] = []; // Buffer for consecutive sidebar elements
  let firstParagraphSeen = false;
  let pendingSubheading: BodyBlock | null = null; // Hold subheading to check if it belongs to a sidebar

  const flushBodyBuffer = () => {
    if (bodyBuffer.length > 0) {
      const paragraphs = mergeBodyParagraphs(bodyBuffer, defaultCharOverride, charOverrideStyles);
      for (const content of paragraphs) {
        const type = !firstParagraphSeen ? "intro" : "paragraph";
        blocks.push({ type, content });
        firstParagraphSeen = true;
      }
      bodyBuffer = [];
    }
  };

  const flushSidebarBuffer = () => {
    if (sidebarBuffer.length > 0) {
      // Merge consecutive sidebar elements into one block
      const mergedContent = sidebarBuffer
        .map((el) => htmlToSemanticHtml(el.content, defaultCharOverride || undefined, charOverrideStyles || undefined))
        .join("\n");
      sidebars.push({
        type: "sidebar",
        content: mergedContent,
      });
      sidebarBuffer = [];
    }
  };

  const flushPendingSubheading = () => {
    if (pendingSubheading) {
      blocks.push(pendingSubheading);
      pendingSubheading = null;
    }
  };

  for (const el of elements) {
    if (el.type === "streamer") {
      flushBodyBuffer();
      flushSidebarBuffer();
      flushPendingSubheading();
      blocks.push({
        type: "streamer",
        content: htmlToSemanticHtml(el.content, defaultCharOverride || undefined, charOverrideStyles || undefined),
      });
    } else if (el.type === "question") {
      flushBodyBuffer();
      flushSidebarBuffer();
      flushPendingSubheading();
      blocks.push({
        type: "question",
        content: htmlToSemanticHtml(el.content, defaultCharOverride || undefined, charOverrideStyles || undefined),
      });
    } else if (el.type === "subheading") {
      flushBodyBuffer();
      flushSidebarBuffer();
      flushPendingSubheading();
      // Hold this subheading - if next element is sidebar, they go together
      pendingSubheading = {
        type: "subheading",
        content: htmlToSemanticHtml(el.content, defaultCharOverride || undefined, charOverrideStyles || undefined),
      };
    } else if (el.type === "sidebar") {
      flushBodyBuffer();
      // If there's a pending subheading, it's the sidebar's title - move to sidebars
      if (pendingSubheading) {
        sidebars.push(pendingSubheading);
        pendingSubheading = null;
      }
      // Add to sidebar buffer (will be merged with consecutive sidebar elements)
      sidebarBuffer.push(el);
    } else if (el.type === "body") {
      flushSidebarBuffer();
      flushPendingSubheading();
      bodyBuffer.push(el);
    }
  }

  // Flush remaining elements
  flushBodyBuffer();
  flushSidebarBuffer();
  flushPendingSubheading();

  // Append sidebars at the end
  blocks.push(...sidebars);

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
 *
 * Special handling for "In memoriam" articles:
 * - First title "In memoriam" becomes category
 * - Second title (name) becomes the article title
 * - Third title with year pattern (e.g., "1938-2026") becomes lifespan
 */
function buildExtractedArticle(
  elements: ArticleElement[],
  charOverrideStyles?: Map<string, CharOverrideStyles> | null
): ExtractedArticle | null {
  // Must have at least a title
  const titleElements = elements.filter((el) => el.type === "title");
  if (titleElements.length === 0) {
    return null;
  }

  // Check for "In memoriam" compound title structure
  let title: string;
  let subtitle: string | null = null;
  let lifespan: string | null = null;
  let inMemoriamCategory = false;

  const firstTitleText = htmlToPlainText(titleElements[0].content);

  if (isInMemoriamTitle(titleElements[0].content) && titleElements.length >= 2) {
    // "In memoriam" article structure
    inMemoriamCategory = true;

    // Second title is the person's name
    title = htmlToPlainText(titleElements[1].content);

    // Third title (if present and matches pattern) is the lifespan
    if (titleElements.length >= 3 && isLifespanTitle(titleElements[2].content)) {
      lifespan = htmlToPlainText(titleElements[2].content).trim();
    }
  } else {
    // Normal article - use first title
    title = firstTitleText;

    // If there are additional titles (not lifespan), the second one is a subtitle
    if (titleElements.length >= 2 && !isLifespanTitle(titleElements[1].content)) {
      subtitle = htmlToPlainText(titleElements[1].content);
    }
  }

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

  // Extract category - "In memoriam" takes precedence, then explicit category element
  let category: string | null = inMemoriamCategory ? "In memoriam" : null;

  if (!category) {
    const categoryElement = elements.find((el) => el.type === "category");
    category = categoryElement
      ? htmlToPlainText(categoryElement.content)
      : null;
  }

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

  // Get all content elements (body, streamer, subheading, sidebar, question) in document order
  const contentElements = elements.filter((el) =>
    el.type === "body" || el.type === "streamer" || el.type === "subheading" || el.type === "sidebar" || el.type === "question"
  );

  // Filter out header/footer content from body and sidebar elements
  const filteredContentElements = contentElements.filter((el) => {
    if (el.type === "body" || el.type === "sidebar") {
      const text = htmlToPlainText(el.content);
      return !isFooterContent(text);
    }
    return true; // Keep streamers, subheadings, and questions
  });

  // Detect the default CharOverride (most common across all body elements)
  const bodyOnlyElements = filteredContentElements.filter((el) => el.type === "body");
  const allBodyHtml = bodyOnlyElements.map((el) => el.content).join("");
  const defaultCharOverride = getDominantCharOverride(allBodyHtml);

  // Build body paragraphs with streamers/subheadings in correct position
  const bodyParagraphs = buildBodyBlocks(filteredContentElements, defaultCharOverride, charOverrideStyles);

  // Build HTML content from body paragraphs (clean semantic HTML)
  const bodyParagraphContents = bodyParagraphs.map((b) => {
    switch (b.type) {
      case "intro":
      case "paragraph":
        return `<p>${b.content}</p>`;
      case "subheading":
        return `<h2>${b.content}</h2>`;
      case "streamer":
        return `<blockquote>${b.content}</blockquote>`;
      case "sidebar":
        return `<aside class="sidebar">${b.content}</aside>`;
      case "question":
        return `<p class="question"><strong>${b.content}</strong></p>`;
      default:
        return `<p>${b.content}</p>`;
    }
  });
  const content = bodyParagraphContents.join("\n");

  // Fallback: if no explicit chapeau, use first "intro" paragraph content (plain text)
  const finalChapeau = chapeau || (() => {
    const introBlock = bodyParagraphs.find((b) => b.type === "intro");
    if (introBlock) {
      // Strip HTML tags to get plain text
      return htmlToPlainText(`<p>${introBlock.content}</p>`);
    }
    return null;
  })();

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
  // Merge consecutive sidebar elements into single blocks
  const sidebars: string[] = [];
  let currentSidebarGroup: string[] = [];
  let lastSidebarIndex = -2; // Track if sidebars are consecutive

  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type === "sidebar") {
      const content = cleanHtml(elements[i].content);
      if (i === lastSidebarIndex + 1) {
        // Consecutive sidebar - add to current group
        currentSidebarGroup.push(content);
      } else {
        // Not consecutive - flush current group and start new one
        if (currentSidebarGroup.length > 0) {
          sidebars.push(currentSidebarGroup.join("\n"));
        }
        currentSidebarGroup = [content];
      }
      lastSidebarIndex = i;
    }
  }
  // Flush remaining sidebar group
  if (currentSidebarGroup.length > 0) {
    sidebars.push(currentSidebarGroup.join("\n"));
  }

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
    subtitle,
    chapeau: finalChapeau,
    bodyParagraphs,
    content,
    category,
    lifespan,
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
            subtitle: article.subtitle || article.lifespan,
            chapeau: article.chapeau,
            content: article.content,
            excerpt: article.chapeau, // Use chapeau as excerpt fallback
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
