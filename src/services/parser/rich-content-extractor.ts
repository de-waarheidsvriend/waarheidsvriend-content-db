import * as cheerio from "cheerio";
import { copyFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import type { PrismaClient, Image } from "@prisma/client";
import type {
  XhtmlExport,
  ExtractedArticle,
  ExtractedImage,
  ImageMappingResult,
  RichContentResult,
  ContentBlock,
  StyleAnalysis,
  LoadedSpread,
} from "@/types";
import { cleanHtml } from "./html-cleaner";

/**
 * Extract rich content (images, quotes, sidebars) from articles
 *
 * This module handles:
 * - Image mapping to articles (FR15)
 * - Excerpt extraction (FR18)
 * - Sidebar/kader extraction (FR19)
 * - Subheading preservation (FR20)
 * - Streamer/quote extraction (FR21)
 *
 * @param articles - Array of extracted articles
 * @param xhtmlExport - The loaded XHTML export
 * @returns Rich content result with images and content blocks
 */
export function extractRichContent(
  articles: ExtractedArticle[],
  xhtmlExport: XhtmlExport
): RichContentResult {
  const errors: string[] = [];
  const allSubheadings: string[] = [];
  const allStreamers: string[] = [];
  const allSidebars: ContentBlock[] = [];
  const allContentBlocks: ContentBlock[] = [];

  console.log(
    `[Rich Content Extractor] Processing ${articles.length} articles for rich content`
  );

  for (const article of articles) {
    try {
      // Extract rich content from each spread the article appears on
      for (const spreadIndex of article.sourceSpreadIndexes) {
        const spread = xhtmlExport.spreads.find(
          (s) => s.spreadIndex === spreadIndex
        );
        if (!spread) continue;

        const richContent = extractRichContentFromSpread(
          spread,
          xhtmlExport.styles,
          article.title
        );

        allSubheadings.push(...richContent.subheadings);
        allStreamers.push(...richContent.streamers);
        allSidebars.push(...richContent.sidebars);
        allContentBlocks.push(...richContent.contentBlocks);
      }
    } catch (error) {
      const errorMsg = `Failed to extract rich content from article "${article.title}": ${error}`;
      errors.push(errorMsg);
      console.error(`[Rich Content Extractor] ${errorMsg}`);
    }
  }

  // Deduplicate
  const uniqueSubheadings = [...new Set(allSubheadings)];
  const uniqueStreamers = [...new Set(allStreamers)];

  console.log(
    `[Rich Content Extractor] Extracted ${uniqueSubheadings.length} subheadings, ${uniqueStreamers.length} streamers, ${allSidebars.length} sidebars`
  );

  return {
    subheadings: uniqueSubheadings,
    streamers: uniqueStreamers,
    sidebars: allSidebars,
    contentBlocks: allContentBlocks,
    errors,
  };
}

/**
 * Extract rich content elements from a single spread
 */
function extractRichContentFromSpread(
  spread: LoadedSpread,
  styles: StyleAnalysis,
  _articleTitle: string
): RichContentResult {
  const subheadings: string[] = [];
  const streamers: string[] = [];
  const sidebars: ContentBlock[] = [];
  const contentBlocks: ContentBlock[] = [];
  let blockOrder = 0;

  const $ = cheerio.load(spread.html);

  // Build selectors
  const subheadingSelector = styles.subheadingClasses.map((c) => `.${c}`).join(", ");
  const streamerSelector = styles.streamerClasses.map((c) => `.${c}`).join(", ");
  const sidebarSelector = styles.sidebarClasses.map((c) => `.${c}`).join(", ");
  // Caption selector prepared for future use
  void styles.captionClasses;

  // Extract subheadings (FR20)
  if (subheadingSelector) {
    $(subheadingSelector).each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        subheadings.push(text);
        contentBlocks.push({
          type: "subheading",
          content: text,
          order: blockOrder++,
        });
      }
    });
  }

  // Extract streamers/quotes (FR21)
  if (streamerSelector) {
    $(streamerSelector).each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        streamers.push(text);
        contentBlocks.push({
          type: "quote",
          content: text,
          order: blockOrder++,
        });
      }
    });
  }

  // Extract sidebars/kaders (FR19)
  if (sidebarSelector) {
    $(sidebarSelector).each((_, el) => {
      const html = $.html(el);
      const cleanedHtml = cleanHtml(html);
      if (cleanedHtml) {
        const sidebar: ContentBlock = {
          type: "sidebar",
          content: cleanedHtml,
          order: blockOrder++,
        };
        sidebars.push(sidebar);
        contentBlocks.push(sidebar);
      }
    });
  }

  return {
    subheadings,
    streamers,
    sidebars,
    contentBlocks,
    errors: [],
  };
}

/**
 * Map images to articles based on HTML references (FR15)
 *
 * @param articles - Array of extracted articles with referencedImages
 * @param xhtmlExport - The loaded XHTML export with image index
 * @returns Array of extracted images with article mappings
 */
export function mapImagesToArticles(
  articles: ExtractedArticle[],
  xhtmlExport: XhtmlExport
): ImageMappingResult {
  const errors: string[] = [];
  const images: ExtractedImage[] = [];

  console.log(
    `[Rich Content Extractor] Mapping images for ${articles.length} articles`
  );

  // Extract caption information from spreads
  const captionMap = extractCaptionsFromSpreads(
    xhtmlExport.spreads,
    xhtmlExport.styles
  );

  for (const article of articles) {
    try {
      let sortOrder = 0;

      for (const imageFilename of article.referencedImages) {
        // Skip author photos (they're handled by author-extractor)
        if (xhtmlExport.images.authorPhotos.includes(imageFilename)) {
          continue;
        }

        // Skip decorative images
        if (xhtmlExport.images.decorativeImages.includes(imageFilename)) {
          continue;
        }

        // Look up source path
        const sourcePath = xhtmlExport.images.images.get(imageFilename);
        if (!sourcePath) {
          console.warn(
            `[Rich Content Extractor] Image not found in index: ${imageFilename}`
          );
          continue;
        }

        // Look up caption
        const caption = captionMap.get(imageFilename) ||
                       article.captions?.get(imageFilename) ||
                       null;

        images.push({
          filename: imageFilename,
          sourcePath,
          caption,
          isFeatured: sortOrder === 0, // First image is featured
          sortOrder,
          articleTitle: article.title,
        });

        sortOrder++;
      }
    } catch (error) {
      const errorMsg = `Failed to map images for article "${article.title}": ${error}`;
      errors.push(errorMsg);
      console.error(`[Rich Content Extractor] ${errorMsg}`);
    }
  }

  console.log(
    `[Rich Content Extractor] Mapped ${images.length} images to articles`
  );

  return { images, errors };
}

/**
 * Extract captions from spreads and map them to image filenames
 */
function extractCaptionsFromSpreads(
  spreads: LoadedSpread[],
  styles: StyleAnalysis
): Map<string, string> {
  const captions = new Map<string, string>();
  const captionSelector = styles.captionClasses.map((c) => `.${c}`).join(", ");

  if (!captionSelector) {
    return captions;
  }

  for (const spread of spreads) {
    const $ = cheerio.load(spread.html);

    // Find all images and their nearby captions
    $("img").each((_, imgEl) => {
      const $img = $(imgEl);
      const src = $img.attr("src");
      if (!src) return;

      // Extract filename from src
      const filename = basename(src);

      // Look for caption near the image
      // Strategy 1: Check parent's next sibling
      const caption = findNearbyCaption($, $img, captionSelector);

      if (caption) {
        captions.set(filename, caption);
      }
    });

    // Also look for standalone captions with image references
    $(captionSelector).each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (!text) return;

      // Check if this caption is near an image that we haven't captioned yet
      const $prevImg = $el.prev("img");
      const $parentPrevImg = $el.parent().prev().find("img").first();

      const nearbyImg = $prevImg.length ? $prevImg : $parentPrevImg;
      if (nearbyImg.length) {
        const src = nearbyImg.attr("src");
        if (src) {
          const filename = basename(src);
          if (!captions.has(filename)) {
            captions.set(filename, text);
          }
        }
      }
    });
  }

  return captions;
}

/**
 * Find caption text near an image element
 */
function findNearbyCaption(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $img: cheerio.Cheerio<any>,
  captionSelector: string
): string | null {
  // Strategy 1: Caption as next sibling
  const $nextSibling = $img.next(captionSelector);
  if ($nextSibling.length) {
    return $nextSibling.text().trim() || null;
  }

  // Strategy 2: Caption in parent's next sibling
  const $parentNext = $img.parent().next(captionSelector);
  if ($parentNext.length) {
    return $parentNext.text().trim() || null;
  }

  // Strategy 3: Caption within same container
  const $container = $img.parent();
  const $captionInContainer = $container.find(captionSelector).first();
  if ($captionInContainer.length) {
    return $captionInContainer.text().trim() || null;
  }

  // Strategy 4: Caption in next container
  const $nextContainer = $container.next();
  const $captionInNext = $nextContainer.find(captionSelector).first();
  if ($captionInNext.length) {
    return $captionInNext.text().trim() || null;
  }

  return null;
}

/**
 * Extract subheadings from article HTML content
 *
 * @param articleHtml - The article's body HTML content
 * @returns Array of subheading texts
 */
export function extractSubheadings(articleHtml: string): string[] {
  if (!articleHtml) return [];

  const $ = cheerio.load(articleHtml);
  const subheadings: string[] = [];

  // Look for h2, h3, h4 elements
  $("h2, h3, h4").each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      subheadings.push(text);
    }
  });

  // Also look for elements with subheading-like classes (case-insensitive)
  $("[class]").each((_, el) => {
    const $el = $(el);
    const className = ($el.attr("class") || "").toLowerCase();
    if (className.includes("tussenkop") || className.includes("subhead")) {
      const text = $el.text().trim();
      if (text && !subheadings.includes(text)) {
        subheadings.push(text);
      }
    }
  });

  return subheadings;
}

/**
 * Extract streamers (pull quotes) from article HTML content
 *
 * @param articleHtml - The article's body HTML content
 * @returns Array of streamer texts
 */
export function extractStreamers(articleHtml: string): string[] {
  if (!articleHtml) return [];

  const $ = cheerio.load(articleHtml);
  const streamers: string[] = [];

  // Look for blockquote elements
  $("blockquote").each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      streamers.push(text);
    }
  });

  // Also look for elements with streamer/quote classes (case-insensitive)
  $("[class]").each((_, el) => {
    const $el = $(el);
    const className = ($el.attr("class") || "").toLowerCase();
    if (
      className.includes("streamer") ||
      className.includes("quote") ||
      className.includes("citaat")
    ) {
      const text = $el.text().trim();
      if (text && !streamers.includes(text)) {
        streamers.push(text);
      }
    }
  });

  return streamers;
}

/**
 * Extract sidebars/kaders from article HTML content
 *
 * @param articleHtml - The article's body HTML content
 * @returns Array of sidebar HTML blocks
 */
export function extractSidebars(articleHtml: string): string[] {
  if (!articleHtml) return [];

  const $ = cheerio.load(articleHtml);
  const sidebars: string[] = [];

  // Look for elements with sidebar/kader classes (case-insensitive)
  $("[class]").each((_, el) => {
    const $el = $(el);
    const className = ($el.attr("class") || "").toLowerCase();
    if (
      className.includes("kader") ||
      className.includes("sidebar") ||
      className.includes("inzet") ||
      className.includes("box")
    ) {
      const html = $.html(el);
      const cleanedHtml = cleanHtml(html);
      if (cleanedHtml && !sidebars.includes(cleanedHtml)) {
        sidebars.push(cleanedHtml);
      }
    }
  });

  // Also look for aside elements
  $("aside").each((_, el) => {
    const html = $.html(el);
    const cleanedHtml = cleanHtml(html);
    if (cleanedHtml && !sidebars.includes(cleanedHtml)) {
      sidebars.push(cleanedHtml);
    }
  });

  return sidebars;
}

/**
 * Result of saving images to the database
 */
export interface SaveImagesResult {
  images: Image[];
  errors: string[];
}

/**
 * Save extracted images to the database and copy files
 *
 * @param prisma - Prisma client instance
 * @param editionId - The ID of the edition
 * @param extractedImages - Array of extracted images
 * @param articleMap - Map of article title to article ID
 * @param xhtmlRootDir - Root directory of XHTML export
 * @param uploadsDir - Base uploads directory
 * @returns Object with created Image records and errors
 */
export async function saveImages(
  prisma: PrismaClient,
  editionId: number,
  extractedImages: ExtractedImage[],
  articleMap: Map<string, number>,
  xhtmlRootDir: string,
  uploadsDir: string
): Promise<SaveImagesResult> {
  const errors: string[] = [];
  const savedImages: Image[] = [];

  console.log(
    `[Rich Content Extractor] Saving ${extractedImages.length} images for edition ${editionId}`
  );

  if (extractedImages.length === 0) {
    return { images: [], errors: [] };
  }

  // Create article images directory
  const articleImagesDir = join(
    uploadsDir,
    "editions",
    String(editionId),
    "images",
    "articles"
  );
  try {
    await mkdir(articleImagesDir, { recursive: true });
  } catch (error) {
    console.warn(`[Rich Content Extractor] Could not create images dir: ${error}`);
  }

  for (const extractedImage of extractedImages) {
    try {
      // Get article ID
      const articleId = articleMap.get(extractedImage.articleTitle);
      if (!articleId) {
        console.warn(
          `[Rich Content Extractor] No article ID found for title: ${extractedImage.articleTitle}`
        );
        continue;
      }

      // Copy image file
      let imageUrl: string | null = null;
      try {
        // Find the actual source path in the XHTML export
        const sourcePath = findImageSourcePath(xhtmlRootDir, extractedImage.sourcePath);
        const destFilename = extractedImage.filename;
        const destPath = join(articleImagesDir, destFilename);

        await copyFile(sourcePath, destPath);
        imageUrl = `/uploads/editions/${editionId}/images/articles/${destFilename}`;
        console.log(
          `[Rich Content Extractor] Copied image ${destFilename} for article ${extractedImage.articleTitle}`
        );
      } catch (copyError) {
        console.warn(
          `[Rich Content Extractor] Could not copy image ${extractedImage.filename}: ${copyError}`
        );
        // Continue without the file - we'll still save the record with relative path
        imageUrl = extractedImage.sourcePath;
      }

      // Save to database
      const image = await prisma.image.create({
        data: {
          article_id: articleId,
          url: imageUrl || extractedImage.sourcePath,
          caption: extractedImage.caption,
          is_featured: extractedImage.isFeatured,
          sort_order: extractedImage.sortOrder,
        },
      });

      savedImages.push(image);
    } catch (error) {
      const errorMsg = `Failed to save image ${extractedImage.filename}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Rich Content Extractor] ${errorMsg}`);
      // Continue with next image (graceful degradation)
    }
  }

  console.log(
    `[Rich Content Extractor] Saved ${savedImages.length} images, ${errors.length} errors`
  );

  return { images: savedImages, errors };
}

/**
 * Find the actual source path for an image in the XHTML export
 */
function findImageSourcePath(xhtmlRootDir: string, relativePath: string): string {
  // Try direct path first
  const directPath = join(xhtmlRootDir, relativePath);

  // Also try with nested content folder (from ZIP extraction)
  // The structure might be: xhtmlRootDir/[content-folder]/publication-web-resources/image/...
  return directPath;
}

/**
 * Build content blocks from article elements for API response
 *
 * @param article - The extracted article
 * @param xhtmlExport - The XHTML export for style information
 * @returns Array of content blocks in order
 */
export function buildContentBlocks(
  article: ExtractedArticle,
  _xhtmlExport: XhtmlExport
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let order = 0;

  // Parse article content
  const $ = cheerio.load(article.content);

  // Process all child elements in order
  $("body > *").each((_, el) => {
    const $el = $(el);
    const tagName = el.type === "tag" ? el.name.toLowerCase() : "";
    const className = $el.attr("class") || "";
    const html = $.html(el);
    const text = $el.text().trim();

    if (!text && tagName !== "img") return;

    // Determine block type
    let type: ContentBlock["type"] = "paragraph";

    // Check for subheadings
    if (
      ["h2", "h3", "h4", "h5", "h6"].includes(tagName) ||
      className.includes("tussenkop") ||
      className.includes("subhead")
    ) {
      type = "subheading";
    }
    // Check for quotes/streamers
    else if (
      tagName === "blockquote" ||
      className.includes("streamer") ||
      className.includes("quote") ||
      className.includes("citaat")
    ) {
      type = "quote";
    }
    // Check for sidebars
    else if (
      tagName === "aside" ||
      className.includes("kader") ||
      className.includes("sidebar") ||
      className.includes("inzet")
    ) {
      type = "sidebar";
    }
    // Check for images
    else if (tagName === "img") {
      type = "image";
      const src = $el.attr("src");
      blocks.push({
        type,
        content: $el.attr("alt") || "",
        imageUrl: src,
        order: order++,
      });
      return;
    }

    blocks.push({
      type,
      content: type === "sidebar" ? cleanHtml(html) : text,
      order: order++,
    });
  });

  return blocks;
}

/**
 * Update article with extracted rich content
 *
 * This function takes the raw extracted article and enriches it with
 * properly extracted subheadings, streamers, sidebars, and captions.
 *
 * @param article - The extracted article to enrich
 * @param xhtmlExport - The XHTML export
 * @returns Enriched article with rich content
 */
export function enrichArticleWithRichContent(
  article: ExtractedArticle,
  xhtmlExport: XhtmlExport
): ExtractedArticle {
  // Extract from article content HTML
  const subheadings = extractSubheadings(article.content);
  const streamers = extractStreamers(article.content);
  const sidebars = extractSidebars(article.content);

  // Extract captions from source spreads
  const captions = new Map<string, string>();
  const captionMap = extractCaptionsFromSpreads(
    xhtmlExport.spreads.filter((s) =>
      article.sourceSpreadIndexes.includes(s.spreadIndex)
    ),
    xhtmlExport.styles
  );

  // Map captions to referenced images
  for (const imageFilename of article.referencedImages) {
    const caption = captionMap.get(imageFilename);
    if (caption) {
      captions.set(imageFilename, caption);
    }
  }

  return {
    ...article,
    subheadings: [...(article.subheadings || []), ...subheadings],
    streamers: [...(article.streamers || []), ...streamers],
    sidebars: [...(article.sidebars || []), ...sidebars],
    captions,
  };
}
