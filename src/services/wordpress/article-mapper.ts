/**
 * Article Mapper
 *
 * Transforms local article data and content blocks to WordPress ACF format.
 * Handles slug generation and publish date calculation.
 */

import type { ApiContentBlock } from "@/types/api";
import type {
  WpAcfComponent,
  WpAcfTextComponent,
  WpAcfQuoteComponent,
  WpAcfTextImageComponent,
  WpAcfFrameComponent,
  WpArticlePayload,
  LocalArticleData,
} from "./types";
import {
  transformToContentBlocks,
  type ImageData,
} from "@/lib/content-blocks";

/**
 * Create a category label text block for the top of the article.
 * Fallback when category cannot be linked via WordPress API.
 *
 * @param categoryName - The category name to display
 * @returns ACF text component with styled category label
 */
export function createCategoryBlock(categoryName: string): WpAcfTextComponent {
  return {
    acf_fc_layout: "text",
    text_text: `<p class="category-label" style="margin-bottom:16px;font-size:14px;color:#666;"><strong>Categorie:</strong> ${escapeHtml(categoryName)}</p>`,
  };
}

/**
 * Create an author info text block for fallback display.
 * Used when author cannot be linked via ACF relationship field
 * (due to WordPress permission restrictions on user creation).
 *
 * @param authorName - The display name of the author
 * @param photoUrl - Optional URL to the author's photo (from WordPress media library)
 * @param bio - Optional author bio text (e.g., "is predikant te Urk")
 * @returns ACF text component with styled author info block
 */
export function createAuthorBlock(
  authorName: string,
  photoUrl?: string,
  bio?: string | null
): WpAcfTextComponent {
  const escapedName = escapeHtml(authorName);
  const photoHtml = photoUrl
    ? `<img src="${photoUrl}" alt="${escapedName}" class="author-photo" style="float:left;margin-right:16px;width:80px;height:80px;border-radius:50%;object-fit:cover;">`
    : '';
  const bioHtml = bio
    ? ` ${escapeHtml(bio)}`
    : '';

  return {
    acf_fc_layout: "text",
    text_text: `<div class="author-block" style="margin-top:32px;padding:16px;background:#f5f5f5;border-radius:8px;overflow:hidden;">${photoHtml}<p style="margin:0;"><strong>${escapedName}</strong>${bioHtml}</p></div>`,
  };
}

/**
 * Convert a single content block to HTML string for combining into text components.
 * Subheadings become <h2>, paragraphs become <p>, etc.
 * Note: Image blocks are handled separately in transformBlocksToAcfComponents.
 */
function blockToHtml(block: ApiContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${escapeHtml(block.content)}</p>`;
    case "subheading":
      return `<h2>${escapeHtml(block.content)}</h2>`;
    case "image":
      // Images are handled separately as text_image components
      return "";
    default:
      return `<p>${escapeHtml(block.content)}</p>`;
  }
}

/**
 * Calculate the character position for paywall insertion (~30% of text content).
 * Returns the character count threshold after which the paywall should be inserted.
 */
function calculatePaywallPosition(blocks: ApiContentBlock[]): number {
  // Count total text characters (excluding quotes which are separate blocks)
  const totalChars = blocks
    .filter(b => b.type !== "quote" && b.type !== "image")
    .reduce((sum, b) => sum + b.content.length, 0);

  return Math.floor(totalChars * 0.3);
}

/**
 * Transform content blocks to ACF components with minimal text blocks and paywall.
 *
 * Rules:
 * - Consecutive text content (paragraphs, subheadings) is combined into single text blocks
 * - Quote and sidebar blocks cause a split (new text block starts after)
 * - Sidebars become separate ACF frame components
 * - A paywall is inserted after ~30% of the text content
 * - Subheadings are rendered as <h2> within text blocks
 * - Image blocks with uploaded media IDs become text_image components
 *
 * @param blocks - Content blocks to transform
 * @param imageIdMap - Optional map of local image URLs to WordPress media IDs
 */
export function transformBlocksToAcfComponents(
  blocks: ApiContentBlock[],
  imageIdMap?: Map<string, number>
): WpAcfComponent[] {
  const components: WpAcfComponent[] = [];

  // Calculate paywall position (character count threshold)
  const paywallCharThreshold = calculatePaywallPosition(blocks);
  let charCount = 0;
  let paywallInserted = false;

  // Accumulator for combining text blocks
  let currentTextHtml = "";

  // Helper to flush accumulated text as a component
  const flushTextBlock = () => {
    if (currentTextHtml.trim()) {
      components.push({
        acf_fc_layout: "text",
        text_text: currentTextHtml,
      });
      currentTextHtml = "";
    }
  };

  // Helper to insert paywall if threshold reached
  const maybeInsertPaywall = () => {
    if (!paywallInserted && charCount >= paywallCharThreshold) {
      // Flush current text before paywall
      flushTextBlock();

      // Insert paywall
      components.push({
        acf_fc_layout: "paywall",
        paywall_message: "",
      });
      paywallInserted = true;
    }
  };

  for (const block of blocks) {
    if (block.type === "quote") {
      // Quotes cause a split - flush text, add quote, then continue accumulating
      flushTextBlock();

      components.push({
        acf_fc_layout: "quote",
        quote_text: block.content,
        quote_author: "",
      });
    } else if (block.type === "sidebar") {
      // Kaders cause a split - flush text, add frame, then continue accumulating
      flushTextBlock();

      components.push({
        acf_fc_layout: "frame",
        frame_text: formatFrameContent(block.content),
      });
    } else if (block.type === "image") {
      // Check if we have a WordPress media ID for this image
      const wpMediaId = imageIdMap?.get(block.imageUrl || "");

      if (wpMediaId) {
        // Image was uploaded - create text_image component
        flushTextBlock();

        const textImageComponent: WpAcfTextImageComponent = {
          acf_fc_layout: "text_image",
          text_image_text: block.caption || "",
          text_image_image: String(wpMediaId),
          text_image_position: "center",
        };
        components.push(textImageComponent);
      }
      // If no media ID, skip the image entirely (don't add as caption text)
      continue;
    } else {
      // Accumulate text content (paragraphs, subheadings)
      const html = blockToHtml(block);
      if (html) {
        currentTextHtml += html;

        // Track character count for paywall positioning
        charCount += block.content.length;

        // Check if we should insert paywall after this block
        maybeInsertPaywall();
      }
    }
  }

  // Flush any remaining text
  flushTextBlock();

  // If paywall wasn't inserted (very short article), insert at end
  if (!paywallInserted && components.length > 0) {
    components.push({
      acf_fc_layout: "paywall",
      paywall_message: "",
    });
  }

  // Filter out invalid/empty components to prevent ACF API errors
  const validatedComponents = components.filter(component => {
    // Text components must have non-empty content
    if (component.acf_fc_layout === "text") {
      const textComp = component as WpAcfTextComponent;
      return textComp.text_text?.trim().length > 0;
    }
    // Quote components must have non-empty text
    if (component.acf_fc_layout === "quote") {
      const quoteComp = component as WpAcfQuoteComponent;
      return quoteComp.quote_text?.trim().length > 0;
    }
    // Frame components must have non-empty text
    if (component.acf_fc_layout === "frame") {
      const frameComp = component as WpAcfFrameComponent;
      return frameComp.frame_text?.trim().length > 0;
    }
    // Paywall components are always valid
    return true;
  });

  // Fallback: ensure at least one component exists
  if (validatedComponents.length === 0) {
    validatedComponents.push({
      acf_fc_layout: "text",
      text_text: "<p>Inhoud niet beschikbaar.</p>",
    });
    validatedComponents.push({
      acf_fc_layout: "paywall",
      paywall_message: "",
    });
  }

  return validatedComponents;
}

/**
 * Map a single content block to ACF Flexible Content component
 * @deprecated Use transformBlocksToAcfComponents for minimal block structure with paywall
 */
export function mapContentBlockToAcf(block: ApiContentBlock): WpAcfComponent {
  switch (block.type) {
    case "paragraph":
      return {
        acf_fc_layout: "text",
        text_text: `<p>${escapeHtml(block.content)}</p>`,
      };

    case "subheading":
      return {
        acf_fc_layout: "text",
        text_text: `<h2>${escapeHtml(block.content)}</h2>`,
      };

    case "quote":
      return {
        acf_fc_layout: "quote",
        quote_text: block.content,
        quote_author: "", // Quote author not available in current content blocks
      };

    case "sidebar":
      return {
        acf_fc_layout: "frame",
        frame_text: formatFrameContent(block.content),
      };

    case "image":
      // Note: text_image_image expects a WordPress media ID (integer), not a URL.
      // Since inline images are not uploaded to WordPress in this flow,
      // we skip image blocks or convert to text if there's a caption.
      // The featured image is handled separately via article_image field.
      if (block.caption) {
        return {
          acf_fc_layout: "text",
          text_text: `<p class="image-caption"><em>${escapeHtml(block.caption)}</em></p>`,
        };
      }
      // Return null for images without captions - will be filtered out
      return null as unknown as WpAcfComponent;

    default:
      // Fallback for unknown types
      return {
        acf_fc_layout: "text",
        text_text: `<p>${escapeHtml(block.content)}</p>`,
      };
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format frame/kader content: add line break after title if present
 * Transforms: "<strong>Titel</strong> tekst" → "<strong>Titel</strong><br>tekst"
 */
function formatFrameContent(content: string): string {
  // Add <br> after closing </strong> tag if it's followed by text
  return content.replace(/(<\/strong>)\s*/i, "$1<br>");
}

/**
 * Generate a URL-safe slug from title and edition number
 * Format: {title-slug}-wv{edition_number}
 * @deprecated Use generateReadableSlug instead for cleaner URLs
 */
export function generateArticleSlug(title: string, editionNumber: number): string {
  const titleSlug = generateReadableSlug(title);
  return `${titleSlug}-wv${editionNumber}`;
}

/**
 * Generate a URL-safe slug from title only (without edition suffix)
 */
export function generateReadableSlug(title: string): string {
  return title
    .toLowerCase()
    // Replace Dutch special characters
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[ç]/g, "c")
    // Remove all non-alphanumeric except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, "")
    // Replace spaces with hyphens
    .replace(/\s+/g, "-")
    // Remove multiple consecutive hyphens
    .replace(/-+/g, "-")
    // Trim hyphens from start/end
    .replace(/^-+|-+$/g, "")
    // Limit length
    .substring(0, 60);
}

/**
 * Calculate the next Thursday at 09:00 NL time for publish date
 */
export function calculatePublishDate(): string {
  const now = new Date();

  // Create a date formatter to work in Amsterdam timezone
  const nlFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Get current NL time parts
  const parts = nlFormatter.formatToParts(now);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const currentNlHour = parseInt(getPart("hour"), 10);
  const currentNlDay = now.getDay(); // 0 = Sunday, 4 = Thursday

  // Calculate days until next Thursday
  let daysUntilThursday = (4 - currentNlDay + 7) % 7;

  // If it's Thursday after 09:00 NL time, use next week's Thursday
  if (daysUntilThursday === 0 && currentNlHour >= 9) {
    daysUntilThursday = 7;
  }

  // If it's before Thursday this week, ensure we get this week's Thursday
  if (daysUntilThursday === 0 && currentNlHour < 9) {
    daysUntilThursday = 0; // Use today (Thursday)
  }

  // Create the target date
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilThursday);

  // Set to 09:00 Amsterdam time
  // We need to convert 09:00 Amsterdam to UTC
  // Amsterdam is UTC+1 in winter, UTC+2 in summer

  // Create a date string for 09:00 Amsterdam time
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");

  // Use a trick: create a date in Amsterdam timezone and get its UTC equivalent
  const amsterdamDateStr = `${year}-${month}-${day}T09:00:00`;

  // Create a date object interpreting the string as Amsterdam time
  // This is done by creating the date and checking the offset
  const testDate = new Date(amsterdamDateStr);

  // Get the offset for Amsterdam on that date
  const amsterdamOffset = getAmsterdamOffsetMinutes(testDate);

  // Calculate UTC time: 09:00 Amsterdam = 09:00 - offset (in hours)
  const utcHour = 9 - amsterdamOffset / 60;
  const utcDate = new Date(
    Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      utcHour,
      0,
      0,
      0
    )
  );

  return utcDate.toISOString();
}

/**
 * Get Amsterdam timezone offset in minutes for a given date
 */
function getAmsterdamOffsetMinutes(date: Date): number {
  // Create formatter that outputs the offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
  });

  const formatted = formatter.format(date);
  // Extract offset like "GMT+1" or "GMT+2"
  const match = formatted.match(/GMT([+-]\d+)/);
  if (match) {
    return parseInt(match[1], 10) * 60;
  }
  return 60; // Default to UTC+1 (winter time)
}

/**
 * Format edition date for WordPress (09:00 Amsterdam time) as UTC
 * Uses the edition date from the source PDF instead of calculating next Thursday.
 */
export function formatEditionDateForWp(editionDate: Date): string {
  const year = editionDate.getFullYear();
  const month = editionDate.getMonth();
  const day = editionDate.getDate();

  // Calculate UTC time for 09:00 Amsterdam
  const amsterdamOffset = getAmsterdamOffsetMinutes(editionDate);
  const utcHour = 9 - amsterdamOffset / 60;

  const utcDate = new Date(Date.UTC(year, month, day, utcHour, 0, 0, 0));
  return utcDate.toISOString();
}

/**
 * Format edition date as local time (09:00 Amsterdam) without timezone suffix.
 * WordPress REST API requires both date (local) and date_gmt (UTC) fields.
 */
export function formatEditionDateLocal(editionDate: Date): string {
  const year = editionDate.getFullYear();
  const month = String(editionDate.getMonth() + 1).padStart(2, '0');
  const day = String(editionDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T09:00:00`;
}

/**
 * Map a local article to WordPress payload format
 *
 * @param article - Local article data from database
 * @param editionNumber - Edition number for slug generation
 * @param editionDate - Edition date for publish date
 * @param authorId - Optional WordPress author ID
 * @param featuredImageId - Optional WordPress featured image media ID
 * @param inlineImageIds - Optional map of local image URLs to WordPress media IDs
 */
export function mapArticleToWpPayload(
  article: LocalArticleData,
  editionNumber: number,
  editionDate: Date,
  authorId?: number,
  featuredImageId?: number,
  inlineImageIds?: Map<string, number>
): WpArticlePayload {
  // Transform content to blocks
  const imageData: ImageData[] = article.images.map((img) => ({
    url: img.url,
    caption: img.caption,
    isFeatured: img.isFeatured,
    sortOrder: img.sortOrder,
  }));

  const contentBlocks = transformToContentBlocks({
    content: article.content,
    images: imageData,
  });

  // Transform blocks to ACF components with minimal text blocks and paywall
  const components = transformBlocksToAcfComponents(contentBlocks, inlineImageIds);

  // Determine article type
  const articleType = article.category?.toLowerCase() === "memoriam"
    ? "memoriam"
    : "default";

  // Generate slug (readable format without edition suffix)
  const slug = generateReadableSlug(article.title);

  // Use edition date from source PDF (at 09:00 Amsterdam time)
  const dateGmt = formatEditionDateForWp(editionDate);
  const dateLocal = formatEditionDateLocal(editionDate);

  return {
    title: article.title,
    slug,
    status: "draft",
    date: dateLocal,
    date_gmt: dateGmt,
    acf: {
      article_type: articleType,
      article_intro: article.chapeau || article.excerpt || "",
      article_subtitle: article.subtitle || "",
      ...(authorId && { article_author: authorId }),
      ...(featuredImageId && { article_image: featuredImageId }),
      components,
    },
  };
}

/**
 * Get the featured image URL from article images
 */
export function getFeaturedImageUrl(article: LocalArticleData): string | null {
  // First try to find explicitly featured image
  const featured = article.images.find((img) => img.isFeatured);
  if (featured) {
    return featured.url;
  }

  // Fall back to first image by sort order
  if (article.images.length > 0) {
    const sorted = [...article.images].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted[0].url;
  }

  return null;
}
