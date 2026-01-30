/**
 * Article Mapper
 *
 * Transforms local article data and content blocks to WordPress ACF format.
 * Handles slug generation and publish date calculation.
 */

import type { ApiContentBlock } from "@/types/api";
import type {
  WpAcfComponent,
  WpArticlePayload,
  LocalArticleData,
} from "./types";
import {
  transformToContentBlocks,
  type ImageData,
} from "@/lib/content-blocks";

/**
 * Map a single content block to ACF Flexible Content component
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
        text_text: `<h3>${escapeHtml(block.content)}</h3>`,
      };

    case "quote":
      return {
        acf_fc_layout: "quote",
        quote_text: block.content,
        quote_author: "", // Quote author not available in current content blocks
      };

    case "sidebar":
      return {
        acf_fc_layout: "text",
        text_text: `<div class="sidebar">${escapeHtml(block.content)}</div>`,
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
 * Generate a URL-safe slug from title and edition number
 * Format: {title-slug}-wv{edition_number}
 */
export function generateArticleSlug(title: string, editionNumber: number): string {
  const titleSlug = title
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

  return `${titleSlug}-wv${editionNumber}`;
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
 * Map a local article to WordPress payload format
 */
export function mapArticleToWpPayload(
  article: LocalArticleData,
  editionNumber: number,
  authorId?: number,
  featuredImageId?: number
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

  // Map content blocks to ACF components, filtering out nulls (skipped image blocks)
  const components: WpAcfComponent[] = contentBlocks
    .map(mapContentBlockToAcf)
    .filter((c): c is WpAcfComponent => c !== null);

  // Determine article type
  const articleType = article.category?.toLowerCase() === "memoriam"
    ? "memoriam"
    : "default";

  // Generate slug
  const slug = generateArticleSlug(article.title, editionNumber);

  // Calculate publish date
  const publishDate = calculatePublishDate();

  return {
    title: article.title,
    slug,
    status: "draft",
    date_gmt: publishDate,
    acf: {
      article_type: articleType,
      article_intro: article.chapeau || article.excerpt || "",
      article_subtitle: "", // Not available in current data structure
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
