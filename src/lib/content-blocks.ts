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
 * Positioned block with original position in HTML for ordering
 */
interface PositionedBlock extends Omit<ApiContentBlock, "order"> {
  position: number;
}

/**
 * Parse HTML content into paragraph and subheading blocks with positions.
 * Handles:
 * - <p> → paragraph blocks
 * - <h2>, <h3>, <h4> → subheading blocks
 * - <blockquote> → quote blocks
 * - <ul>, <ol> → paragraph blocks (list items joined)
 * - <div> → paragraph blocks (if has content, and not sidebar)
 * - <aside> and sidebar divs → sidebar blocks
 * - Text content extraction
 *
 * Returns blocks with their original position in HTML for proper ordering.
 */
export function parseHtmlToBlocksWithPosition(html: string): PositionedBlock[] {
  const blocks: PositionedBlock[] = [];

  if (!html || html.trim() === "") {
    return blocks;
  }

  // First, find sidebar/aside positions so we can exclude them from regular div parsing
  const sidebarPositions: Array<{ start: number; end: number }> = [];

  // Find aside elements
  const asidePattern = /<aside[^>]*>[\s\S]*?<\/aside>/gi;
  let asideMatch;
  while ((asideMatch = asidePattern.exec(html)) !== null) {
    sidebarPositions.push({ start: asideMatch.index, end: asideMatch.index + asideMatch[0].length });
    // Extract sidebar block
    const innerContent = asideMatch[0].replace(/<aside[^>]*>/, "").replace(/<\/aside>$/, "");
    const cleanContent = cleanHtmlContent(innerContent);
    if (cleanContent.trim()) {
      blocks.push({
        type: "sidebar",
        content: cleanContent.trim(),
        position: asideMatch.index,
      });
    }
  }

  // Find sidebar/kader divs and extract content with balanced matching
  const divStartPattern = /<div([^>]*class="[^"]*(?:sidebar|kader)[^"]*"[^>]*)>/gi;
  let divMatch;
  while ((divMatch = divStartPattern.exec(html)) !== null) {
    const startIndex = divMatch.index + divMatch[0].length;
    const innerContent = extractBalancedDivContent(html, startIndex);
    // Find the end position by calculating where the content ends plus closing tag
    const endIndex = startIndex + innerContent.length + "</div>".length;
    sidebarPositions.push({ start: divMatch.index, end: endIndex });

    const cleanContent = cleanHtmlContent(innerContent);
    if (cleanContent.trim()) {
      blocks.push({
        type: "sidebar",
        content: cleanContent.trim(),
        position: divMatch.index,
      });
    }
  }

  // Helper to check if position is inside a sidebar
  const isInsideSidebar = (pos: number): boolean => {
    return sidebarPositions.some(s => pos >= s.start && pos < s.end);
  };

  // Simple HTML parsing using regex (no DOM dependency for server-side)
  // Match paragraphs, headings, blockquotes, lists, and divs
  const elementPattern =
    /<(p|h[234]|blockquote|ul|ol|div)(?:\s+[^>]*)?>([^]*?)<\/\1>/gi;

  let match;
  while ((match = elementPattern.exec(html)) !== null) {
    const [fullMatch, tag, innerContent] = match;
    const tagLower = tag.toLowerCase();

    // Skip if this match is inside a sidebar region
    if (isInsideSidebar(match.index)) {
      continue;
    }

    // Skip divs with sidebar/kader class (already processed above)
    if (tagLower === "div" && /class="[^"]*(?:sidebar|kader)[^"]*"/i.test(fullMatch)) {
      continue;
    }

    // Clean inner content: remove nested tags, normalize whitespace
    const cleanContent = cleanHtmlContent(innerContent);

    if (!cleanContent.trim()) {
      continue;
    }

    let type: ContentBlockType;
    switch (tagLower) {
      case "h2":
      case "h3":
      case "h4":
        type = "subheading";
        break;
      case "blockquote":
        type = "quote";
        break;
      case "ul":
      case "ol":
      case "div":
        // Lists and divs become paragraph blocks
        type = "paragraph";
        break;
      default:
        type = "paragraph";
    }

    blocks.push({
      type,
      content: cleanContent.trim(),
      position: match.index,
    });
  }

  // Check for unrecognized top-level elements and log warning
  const recognizedTags = ["p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "div", "aside", "span", "br", "a", "em", "strong", "i", "b", "img"];
  const topLevelTagPattern = /<([a-z][a-z0-9]*)/gi;
  let tagMatch;
  const unrecognizedTags = new Set<string>();
  while ((tagMatch = topLevelTagPattern.exec(html)) !== null) {
    const foundTag = tagMatch[1].toLowerCase();
    if (!recognizedTags.includes(foundTag)) {
      unrecognizedTags.add(foundTag);
    }
  }
  if (unrecognizedTags.size > 0) {
    console.warn(`[content-blocks] Unrecognized HTML tags skipped: ${Array.from(unrecognizedTags).join(", ")}`);
  }

  // Sort by position to maintain publication order
  return blocks.sort((a, b) => a.position - b.position);
}

/**
 * Parse HTML content into paragraph and subheading blocks (without position tracking).
 * This is a convenience wrapper for backwards compatibility.
 */
export function parseHtmlToBlocks(html: string): Omit<ApiContentBlock, "order">[] {
  return parseHtmlToBlocksWithPosition(html).map(({ position, ...block }) => block);
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
 * This function looks for common sidebar patterns and handles nested divs properly.
 *
 * Note: This function is kept for backwards compatibility but sidebars are now
 * extracted in parseHtmlToBlocksWithPosition for proper ordering.
 */
export function extractSidebarBlocks(html: string): Omit<ApiContentBlock, "order">[] {
  const blocks: Omit<ApiContentBlock, "order">[] = [];

  if (!html) return blocks;

  // Extract aside elements (simpler case, less likely to have deep nesting)
  const asidePattern = /<aside[^>]*>([\s\S]*?)<\/aside>/gi;
  let match;
  while ((match = asidePattern.exec(html)) !== null) {
    const [, innerContent] = match;
    const cleanContent = cleanHtmlContent(innerContent);
    if (cleanContent.trim()) {
      blocks.push({
        type: "sidebar",
        content: cleanContent.trim(),
      });
    }
  }

  // Extract divs with sidebar/kader classes using balanced matching
  const divStartPattern = /<div([^>]*class="[^"]*(?:sidebar|kader)[^"]*"[^>]*)>/gi;
  let divMatch;
  while ((divMatch = divStartPattern.exec(html)) !== null) {
    const startIndex = divMatch.index + divMatch[0].length;
    const innerContent = extractBalancedDivContent(html, startIndex);
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
 * Extract content from a div by properly handling nested div tags.
 * @param html - The HTML string
 * @param startIndex - The index after the opening div tag
 * @returns The inner content of the div
 */
function extractBalancedDivContent(html: string, startIndex: number): string {
  let depth = 1;
  let index = startIndex;
  const openTag = /<div[^>]*>/gi;
  const closeTag = /<\/div>/gi;

  while (depth > 0 && index < html.length) {
    openTag.lastIndex = index;
    closeTag.lastIndex = index;

    const nextOpen = openTag.exec(html);
    const nextClose = closeTag.exec(html);

    if (!nextClose) {
      // No closing tag found, return rest of string
      break;
    }

    if (!nextOpen || nextClose.index < nextOpen.index) {
      // Closing tag comes first
      depth--;
      if (depth === 0) {
        return html.slice(startIndex, nextClose.index);
      }
      index = nextClose.index + nextClose[0].length;
    } else {
      // Opening tag comes first
      depth++;
      index = nextOpen.index + nextOpen[0].length;
    }
  }

  // Fallback: return from start to end
  return html.slice(startIndex);
}

/**
 * Transform article data into ordered content blocks.
 * Preserves publication order: text, sidebars, and images are placed in their original positions.
 * Images are inserted at positions based on their sortOrder relative to text block count.
 */
export function transformToContentBlocks(article: ArticleData): ApiContentBlock[] {
  // Parse HTML content into blocks (includes sidebars in correct position)
  const positionedBlocks = parseHtmlToBlocksWithPosition(article.content);

  // Create image blocks (non-featured only)
  const imageBlocks = createImageBlocks(article.images);

  // If no text/sidebar blocks, just return image blocks
  if (positionedBlocks.length === 0) {
    return imageBlocks.map((block, index) => ({ ...block, order: index }));
  }

  // If no images, just return text/sidebar blocks with order
  if (imageBlocks.length === 0) {
    return positionedBlocks.map(({ position, ...block }, index) => ({
      ...block,
      order: index,
    }));
  }

  // Insert images at positions based on their sortOrder
  // sortOrder 0 goes after first block, sortOrder 1 after second, etc.
  // Higher sortOrders are distributed proportionally if they exceed text block count
  const nonFeaturedImages = article.images.filter(img => !img.isFeatured);
  const sortedImages = [...nonFeaturedImages].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build final block list with images inserted at appropriate positions
  const allBlocks: Omit<ApiContentBlock, "order">[] = [];
  const textBlockCount = positionedBlocks.length;

  // Create a map of positions to insert images
  // Image at sortOrder N goes after text block N (0-indexed)
  const imageInsertions = new Map<number, Omit<ApiContentBlock, "order">[]>();

  for (let i = 0; i < sortedImages.length; i++) {
    const img = sortedImages[i];
    // Use sortOrder as insertion position, capped at last text block position
    const insertAfter = Math.min(img.sortOrder, textBlockCount - 1);

    if (!imageInsertions.has(insertAfter)) {
      imageInsertions.set(insertAfter, []);
    }
    imageInsertions.get(insertAfter)!.push({
      type: "image",
      content: img.caption || "",
      imageUrl: img.url,
      caption: img.caption || undefined,
    });
  }

  // Build final list: add text/sidebar blocks and insert images after each
  for (let i = 0; i < positionedBlocks.length; i++) {
    const { position, ...block } = positionedBlocks[i];
    allBlocks.push(block);

    // Insert any images that should come after this block
    const imagesToInsert = imageInsertions.get(i);
    if (imagesToInsert) {
      allBlocks.push(...imagesToInsert);
    }
  }

  // Assign sequential order numbers
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
