/**
 * Content Blocks Transformer
 *
 * Transforms article content HTML and related data into structured content blocks
 * for the WordPress Content API.
 */

import type { ApiContentBlock, ContentBlockType } from "@/types/api";

/**
 * Image data for content block transformation
 */
export interface ImageData {
  url: string;
  caption: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

/**
 * Article data for content block transformation
 */
export interface ArticleData {
  content: string;
  images: ImageData[];
}

/**
 * Parse HTML content into paragraph and subheading blocks.
 * Handles:
 * - <p> → paragraph blocks
 * - <h2>, <h3> → subheading blocks
 * - <blockquote> → quote blocks
 * - Text content extraction
 */
export function parseHtmlToBlocks(html: string): Omit<ApiContentBlock, "order">[] {
  const blocks: Omit<ApiContentBlock, "order">[] = [];

  if (!html || html.trim() === "") {
    return blocks;
  }

  // Simple HTML parsing using regex (no DOM dependency for server-side)
  // Match paragraphs, headings, and blockquotes
  const elementPattern =
    /<(p|h[23]|blockquote)(?:\s+[^>]*)?>([^]*?)<\/\1>/gi;

  let match;
  while ((match = elementPattern.exec(html)) !== null) {
    const [, tag, innerContent] = match;
    const tagLower = tag.toLowerCase();

    // Clean inner content: remove nested tags, normalize whitespace
    const cleanContent = cleanHtmlContent(innerContent);

    if (!cleanContent.trim()) {
      continue;
    }

    let type: ContentBlockType;
    switch (tagLower) {
      case "h2":
      case "h3":
        type = "subheading";
        break;
      case "blockquote":
        type = "quote";
        break;
      default:
        type = "paragraph";
    }

    blocks.push({
      type,
      content: cleanContent.trim(),
    });
  }

  return blocks;
}

/**
 * Clean HTML content by removing tags and normalizing whitespace
 */
export function cleanHtmlContent(html: string): string {
  if (!html) return "";

  // Remove all HTML tags
  let text = html.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ");

  return text.trim();
}

/**
 * Create image blocks from image data
 */
export function createImageBlocks(images: ImageData[]): Omit<ApiContentBlock, "order">[] {
  // Filter out featured images (they're handled separately)
  const nonFeaturedImages = images.filter((img) => !img.isFeatured);

  // Sort by sortOrder
  const sortedImages = [...nonFeaturedImages].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return sortedImages.map((img) => ({
    type: "image" as ContentBlockType,
    content: img.caption || "",
    imageUrl: img.url,
    caption: img.caption || undefined,
  }));
}

/**
 * Extract sidebar blocks from HTML content.
 * Sidebars are typically marked with specific classes or div structures.
 * This function looks for common sidebar patterns.
 */
export function extractSidebarBlocks(html: string): Omit<ApiContentBlock, "order">[] {
  const blocks: Omit<ApiContentBlock, "order">[] = [];

  if (!html) return blocks;

  // Look for aside elements or divs with sidebar/kader classes
  const sidebarPattern =
    /<(?:aside|div[^>]*class="[^"]*(?:sidebar|kader)[^"]*"[^>]*)>([^]*?)<\/(?:aside|div)>/gi;

  let match;
  while ((match = sidebarPattern.exec(html)) !== null) {
    const [, innerContent] = match;
    const cleanContent = cleanHtmlContent(innerContent);

    if (cleanContent.trim()) {
      blocks.push({
        type: "sidebar",
        content: cleanContent.trim(),
      });
    }
  }

  return blocks;
}

/**
 * Transform article data into ordered content blocks.
 * Interleaves text blocks with image blocks based on sort order.
 */
export function transformToContentBlocks(article: ArticleData): ApiContentBlock[] {
  // Parse HTML content into blocks
  const textBlocks = parseHtmlToBlocks(article.content);

  // Extract sidebar blocks
  const sidebarBlocks = extractSidebarBlocks(article.content);

  // Create image blocks (non-featured only)
  const imageBlocks = createImageBlocks(article.images);

  // Combine all blocks and assign order
  const allBlocks: ApiContentBlock[] = [];
  let order = 0;

  // Add text blocks first (paragraphs, subheadings, quotes)
  for (const block of textBlocks) {
    allBlocks.push({ ...block, order: order++ });
  }

  // Interleave images based on their sortOrder
  // Images are inserted proportionally throughout the content
  if (imageBlocks.length > 0 && allBlocks.length > 0) {
    const interval = Math.ceil(allBlocks.length / (imageBlocks.length + 1));
    let insertPosition = interval;

    for (const imgBlock of imageBlocks) {
      // Insert at calculated position
      const insertIndex = Math.min(insertPosition, allBlocks.length);
      allBlocks.splice(insertIndex, 0, { ...imgBlock, order: 0 });
      insertPosition += interval + 1;
    }
  } else {
    // If no text blocks, just add image blocks
    for (const imgBlock of imageBlocks) {
      allBlocks.push({ ...imgBlock, order: order++ });
    }
  }

  // Add sidebar blocks at the end
  for (const sidebarBlock of sidebarBlocks) {
    allBlocks.push({ ...sidebarBlock, order: order++ });
  }

  // Re-assign order numbers sequentially
  return allBlocks.map((block, index) => ({
    ...block,
    order: index,
  }));
}

/**
 * Get the featured image from image data
 */
export function getFeaturedImage(images: ImageData[]): { url: string; caption: string | null } | null {
  // First try to find explicitly featured image
  const featured = images.find((img) => img.isFeatured);
  if (featured) {
    return { url: featured.url, caption: featured.caption };
  }

  // Fall back to first image by sort order
  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    return { url: sorted[0].url, caption: sorted[0].caption };
  }

  return null;
}
