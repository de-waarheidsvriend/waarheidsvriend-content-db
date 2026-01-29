import * as cheerio from "cheerio";

/**
 * Clean InDesign-generated HTML to semantic HTML
 *
 * Removes:
 * - InDesign override spans (CharOverride, ParaOverride, _idGen)
 * - Empty elements (p, span, div without content)
 * - Unnecessary wrapper divs
 *
 * Preserves:
 * - Semantic HTML (p, h2, h3, blockquote, strong, em, a)
 *
 * @param html - Raw HTML from InDesign export
 * @returns Cleaned semantic HTML
 */
export function cleanHtml(html: string): string {
  if (!html || !html.trim()) {
    return "";
  }

  const $ = cheerio.load(html, { xmlMode: false });

  // 1. Remove InDesign override spans (keep content)
  $(
    '[class*="CharOverride"], [class*="ParaOverride"], [class*="_idGen"]'
  ).each((_, el) => {
    $(el).replaceWith($(el).html() || "");
  });

  // 2. Unwrap unnecessary wrapper divs (divs without semantic class or id)
  $("div").each((_, el) => {
    const $el = $(el);
    if (!$el.attr("class") && !$el.attr("id")) {
      $el.replaceWith($el.html() || "");
    }
  });

  // 3. Remove empty elements (must be after unwrapping to catch newly emptied ones)
  // Repeat until no more empty elements are found
  let hasEmpty = true;
  while (hasEmpty) {
    const emptyElements = $("p:empty, span:empty, div:empty");
    hasEmpty = emptyElements.length > 0;
    emptyElements.remove();
  }

  // 4. Clean up class attributes - remove InDesign-specific classes
  $("[class]").each((_, el) => {
    const $el = $(el);
    const classes = ($el.attr("class") || "").split(/\s+/);
    const cleanedClasses = classes.filter(
      (cls) =>
        cls &&
        !cls.startsWith("CharOverride") &&
        !cls.startsWith("ParaOverride") &&
        !cls.startsWith("_idGen") &&
        !cls.startsWith("ObjectStyle")
    );
    if (cleanedClasses.length > 0) {
      $el.attr("class", cleanedClasses.join(" "));
    } else {
      $el.removeAttr("class");
    }
  });

  // 5. Get body content
  let cleaned = $("body").html() || $.html();

  // 6. Normalize whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, "> <");

  // 7. Collapse multiple spaces to single space
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // 8. Remove leading/trailing whitespace from the result
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract plain text from HTML, stripping all tags
 *
 * @param html - HTML content
 * @returns Plain text content
 */
export function htmlToPlainText(html: string): string {
  if (!html || !html.trim()) {
    return "";
  }

  const $ = cheerio.load(html);
  return $("body").text().trim() || $.root().text().trim();
}

/**
 * Generate an excerpt from HTML content
 *
 * @param html - HTML content
 * @param maxLength - Maximum length of excerpt (default 150)
 * @returns Plain text excerpt with ellipsis if truncated
 */
export function generateExcerpt(html: string, maxLength: number = 150): string {
  const plainText = htmlToPlainText(html);

  if (!plainText) {
    return "";
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last space before maxLength to avoid cutting words
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}
