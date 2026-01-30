import * as cheerio from "cheerio";

/**
 * CharOverride styling information parsed from CSS
 */
export interface CharOverrideStyles {
  isItalic: boolean;
  isBold: boolean;
}

/**
 * Parse CSS content to extract CharOverride styling information
 *
 * Looks for font-weight: bold and font-style: italic in CharOverride class definitions.
 *
 * @param cssContent - Raw CSS content
 * @returns Map of CharOverride class name to styling information
 */
export function parseCharOverrideStyles(cssContent: string): Map<string, CharOverrideStyles> {
  const styles = new Map<string, CharOverrideStyles>();

  // Match span.CharOverride-N { ... } blocks
  const blockRegex = /span\.(CharOverride-\d+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = blockRegex.exec(cssContent)) !== null) {
    const className = match[1];
    const cssBlock = match[2];

    // Check for font-weight: bold
    const isBold = /font-weight\s*:\s*bold/i.test(cssBlock);

    // Check for font-style: italic
    const isItalic = /font-style\s*:\s*italic/i.test(cssBlock);

    styles.set(className, { isItalic, isBold });
  }

  return styles;
}

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
 * Extract Y position from a span's style attribute
 * Returns the top value in pixels, or null if not found
 */
function getYPosition(style: string | undefined): number | null {
  if (!style) return null;
  const match = style.match(/top:\s*([\d.]+)px/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract Y-position range from HTML element (for paragraph gap detection)
 * Returns the first and last Y-positions of spans within the element.
 *
 * @param html - HTML content with positioned spans
 * @returns Object with yStart and yEnd, or null if no spans found
 */
export function getYRange(html: string): { yStart: number; yEnd: number } | null {
  if (!html || !html.trim()) return null;

  const $ = cheerio.load(html);
  const spans = $("span[style*='top:']");

  if (spans.length === 0) return null;

  let yStart: number | null = null;
  let yEnd: number | null = null;

  spans.each((_, span) => {
    const style = $(span).attr("style");
    const y = getYPosition(style);
    if (y !== null) {
      if (yStart === null || y < yStart) yStart = y;
      if (yEnd === null || y > yEnd) yEnd = y;
    }
  });

  if (yStart === null || yEnd === null) return null;
  return { yStart, yEnd };
}

/**
 * Extract text from element with spans, fixing hyphenation at span boundaries
 * and preserving line breaks based on Y-position changes.
 *
 * In InDesign single-page exports, text is split into absolute-positioned spans.
 * Word hyphenation appears as a span ending with "-" followed by a span starting
 * with a lowercase letter. This function merges those correctly while preserving
 * intentional compound words like "een-woord".
 *
 * Line breaks are detected by significant Y-position changes between spans.
 */
function extractTextFromSpans($: cheerio.CheerioAPI, $el: cheerio.Cheerio<cheerio.Element>): string {
  const parts: { text: string; y: number | null }[] = [];

  $el.find("span").each((_, span) => {
    const $span = $(span);
    const text = $span.text();
    if (text) {
      const style = $span.attr("style");
      const y = getYPosition(style);
      parts.push({ text, y });
    }
  });

  // If no spans found, fall back to regular text extraction
  if (parts.length === 0) {
    return $el.text().trim();
  }

  // Join parts, removing hyphens and adding line breaks where Y changes
  let result = "";
  let lastY: number | null = null;
  let skipNextLineBreak = false; // Skip line break after word hyphenation

  for (let i = 0; i < parts.length; i++) {
    const { text, y } = parts[i];
    const nextPart = parts[i + 1];

    // Check if this part ends with hyphen and next starts with lowercase
    // This is word hyphenation - merge the word (no line break)
    if (text.endsWith("-") && nextPart && /^[a-z]/.test(nextPart.text)) {
      // Remove trailing hyphen (it's word hyphenation, not a compound word)
      result += text.slice(0, -1);
      // Skip line break for the next part - we're continuing a word
      skipNextLineBreak = true;
    } else {
      // Check if Y position changed significantly (new line)
      // Typical line height is ~250px in InDesign exports
      if (!skipNextLineBreak && lastY !== null && y !== null && Math.abs(y - lastY) > 100) {
        // New line - add line break (but not if result already ends with one)
        if (!result.endsWith("\n")) {
          result = result.trimEnd() + "\n";
        }
      }
      skipNextLineBreak = false;
      result += text;
    }

    if (y !== null) {
      lastY = y;
    }
  }

  // Normalize spaces within lines but preserve line breaks
  return result
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
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
 * Preserves line breaks based on Y-position changes between spans
 *
 * @param html - Raw HTML from InDesign export
 * @param defaultCharOverride - The CharOverride class used for normal text
 * @param charOverrideStyles - Map of CharOverride class name to styling (bold/italic)
 * @returns Cleaned HTML with <em> for italic, <strong> for bold, and \n for line breaks
 */
export function htmlToSemanticHtml(
  html: string,
  defaultCharOverride?: string,
  charOverrideStyles?: Map<string, CharOverrideStyles>
): string {
  if (!html || !html.trim()) {
    return "";
  }

  const $ = cheerio.load(html);
  const $body = $("body");

  // Extract text from spans with italic/bold information
  const parts: { text: string; isItalic: boolean; isBold: boolean; y: number | null }[] = [];

  $body.find("span").each((_, span) => {
    const $span = $(span);
    const text = $span.text();
    if (!text) return;

    const classes = ($span.attr("class") || "").split(/\s+/);
    const charOverride = classes.find((c) => c.startsWith("CharOverride"));
    const style = $span.attr("style");
    const y = getYPosition(style);

    // Check if this is an introletter (drop cap) span - these should not be styled
    const isIntroletter = classes.some((c) => c.toLowerCase().includes("introletter"));

    let isItalic = false;
    let isBold = false;

    if (!isIntroletter && charOverride && charOverride !== defaultCharOverride) {
      // Look up styling from CSS if available
      const cssStyles = charOverrideStyles?.get(charOverride);
      if (cssStyles) {
        isItalic = cssStyles.isItalic;
        isBold = cssStyles.isBold;
      } else {
        // Fallback: if no CSS info available, treat non-default as italic (legacy behavior)
        isItalic = !!defaultCharOverride;
      }
    }

    parts.push({ text, isItalic, isBold, y });
  });

  if (parts.length === 0) {
    return $body.text().trim();
  }

  // Join parts with hyphenation fix and line break detection
  let result = "";
  let lastY: number | null = null;
  let skipNextLineBreak = false; // Skip line break after word hyphenation

  for (let i = 0; i < parts.length; i++) {
    const { text, isItalic, isBold, y } = parts[i];
    const nextPart = parts[i + 1];

    // Handle hyphenation at span boundaries FIRST
    // This is word hyphenation - merge the word (no line break)
    if (text.endsWith("-") && nextPart && /^[a-z]/.test(nextPart.text)) {
      // Remove hyphen - it's word hyphenation, not a compound word
      result += wrapWithTags(text.slice(0, -1), isBold, isItalic);
      // Skip line break for the next part - we're continuing a word
      skipNextLineBreak = true;
    } else {
      // Check if Y position changed significantly (new line)
      if (!skipNextLineBreak && lastY !== null && y !== null && Math.abs(y - lastY) > 100) {
        // New line - add line break
        if (!result.endsWith("\n")) {
          result = result.trimEnd() + "\n";
        }
      }
      skipNextLineBreak = false;

      result += wrapWithTags(text, isBold, isItalic);
    }

    if (y !== null) {
      lastY = y;
    }
  }

  // Merge adjacent <strong> and <em> tags (including across line breaks)
  result = result.replace(/<\/strong>\s*<strong>/g, " ");
  result = result.replace(/<\/strong>\n<strong>/g, "\n");
  result = result.replace(/<\/em>\s*<em>/g, " ");
  result = result.replace(/<\/em>\n<em>/g, "\n");
  // Also handle nested tags: </em></strong> <strong><em>
  result = result.replace(/<\/em><\/strong>\s*<strong><em>/g, " ");
  result = result.replace(/<\/em><\/strong>\n<strong><em>/g, "\n");

  // Normalize spaces within lines but preserve line breaks
  return result
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

/**
 * Wrap text with appropriate HTML tags based on bold/italic flags
 */
function wrapWithTags(text: string, isBold: boolean, isItalic: boolean): string {
  if (isBold && isItalic) {
    return `<strong><em>${text}</em></strong>`;
  } else if (isBold) {
    return `<strong>${text}</strong>`;
  } else if (isItalic) {
    return `<em>${text}</em>`;
  }
  return text;
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
