import * as cheerio from "cheerio";

/**
 * Fix hyphenation in text (words broken across lines with hyphens)
 *
 * Only merges if: after hyphen comes lowercase (word continuation, not proper noun)
 *
 * @param text - Text with potential hyphenation
 * @returns Text with hyphenation fixed
 */
export function fixHyphenation(text: string): string {
  return text.replace(/(\w)-\s*([a-z])/g, "$1$2");
}

/**
 * Check if text is footer content (page number, magazine name/date)
 *
 * @param text - Text to check
 * @returns True if text appears to be footer content
 */
export function isFooterContent(text: string): boolean {
  const trimmed = text.trim();
  // Just a number (page number)
  if (/^\d{1,3}$/.test(trimmed)) {
    return true;
  }
  // Magazine name with date pattern
  if (/De Waarheidsvriend\s+\d{1,2}\s+\w+\s+\d{4}/i.test(trimmed)) {
    return true;
  }
  return false;
}

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
  const $body = $("body");

  // Use hyphenation-aware extraction if there are spans (single-page export)
  if ($body.find("span").length > 0) {
    return extractTextFromSpans($, $body);
  }

  return $body.text().trim() || $.root().text().trim();
}

/**
 * Extract text from element with spans, fixing hyphenation at span boundaries
 *
 * In InDesign single-page exports, text is split into absolute-positioned spans.
 * Word hyphenation appears as a span ending with "-" followed by a span starting
 * with a lowercase letter. This function merges those correctly while preserving
 * intentional compound words like "een-woord".
 */
function extractTextFromSpans($: cheerio.CheerioAPI, $el: cheerio.Cheerio<cheerio.Element>): string {
  const parts: string[] = [];

  $el.find("span").each((_, span) => {
    const text = $(span).text();
    if (text) {
      parts.push(text);
    }
  });

  // If no spans found, fall back to regular text extraction
  if (parts.length === 0) {
    return $el.text().trim();
  }

  // Join parts, removing hyphens that appear at end of a span followed by lowercase
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    // Check if this part ends with hyphen and next starts with lowercase
    if (part.endsWith("-") && nextPart && /^[a-z]/.test(nextPart)) {
      // Remove trailing hyphen (it's a line break, not a compound word)
      result += part.slice(0, -1);
    } else {
      result += part;
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * Get the dominant CharOverride class from an element
 * Used to detect styling consistency for paragraph merging
 *
 * @param html - HTML content
 * @returns The most common CharOverride class, or null if none
 */
export function getDominantCharOverride(html: string): string | null {
  if (!html) return null;

  const $ = cheerio.load(html);
  const counts: Record<string, number> = {};

  $("[class*='CharOverride']").each((_, el) => {
    const classes = ($(el).attr("class") || "").split(/\s+/);
    for (const cls of classes) {
      if (cls.startsWith("CharOverride")) {
        counts[cls] = (counts[cls] || 0) + 1;
      }
    }
  });

  let maxCount = 0;
  let dominant: string | null = null;
  for (const [cls, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cls;
    }
  }

  return dominant;
}

/**
 * Convert InDesign HTML to simplified semantic HTML
 * Preserves italic and bold formatting based on CharOverride classes
 *
 * @param html - Raw HTML from InDesign export
 * @param defaultCharOverride - The CharOverride class used for normal text (others become italic)
 * @returns Cleaned HTML with <em> for italic text
 */
export function htmlToSemanticHtml(html: string, defaultCharOverride?: string): string {
  if (!html || !html.trim()) {
    return "";
  }

  const $ = cheerio.load(html);
  const $body = $("body");

  // Extract text from spans, marking non-default CharOverride as italic
  const parts: string[] = [];

  $body.find("span").each((_, span) => {
    const $span = $(span);
    const text = $span.text();
    if (!text) return;

    const classes = ($span.attr("class") || "").split(/\s+/);
    const charOverride = classes.find((c) => c.startsWith("CharOverride"));

    // If this CharOverride differs from default, wrap in <em>
    if (defaultCharOverride && charOverride && charOverride !== defaultCharOverride) {
      parts.push(`<em>${text}</em>`);
    } else {
      parts.push(text);
    }
  });

  if (parts.length === 0) {
    return $body.text().trim();
  }

  // Join parts with hyphenation fix
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    // Handle hyphenation at span boundaries
    const isItalic = part.startsWith("<em>") && part.endsWith("</em>");
    const textContent = isItalic ? part.slice(4, -5) : part;

    if (textContent.endsWith("-") && nextPart) {
      const nextIsItalic = nextPart.startsWith("<em>");
      const nextText = nextIsItalic ? nextPart.slice(4, -5) : nextPart;
      if (/^[a-z]/.test(nextText)) {
        // Remove hyphen - it's line continuation
        if (isItalic) {
          result += `<em>${textContent.slice(0, -1)}</em>`;
        } else {
          result += textContent.slice(0, -1);
        }
        continue;
      }
    }
    result += part;
  }

  // Merge adjacent <em> tags
  result = result.replace(/<\/em>\s*<em>/g, " ");

  return result.replace(/\s+/g, " ").trim();
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
