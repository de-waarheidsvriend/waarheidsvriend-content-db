import { describe, it, expect } from "vitest";
import { cleanHtml, htmlToPlainText, generateExcerpt } from "./html-cleaner";

describe("html-cleaner", () => {
  describe("cleanHtml", () => {
    it("should remove InDesign CharOverride spans", () => {
      const html =
        '<p>Hello <span class="CharOverride-1">world</span></p>';
      const result = cleanHtml(html);

      expect(result).not.toContain("CharOverride");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });

    it("should remove InDesign ParaOverride spans", () => {
      const html =
        '<p><span class="ParaOverride-2">Some text</span></p>';
      const result = cleanHtml(html);

      expect(result).not.toContain("ParaOverride");
      expect(result).toContain("Some text");
    });

    it("should remove _idGen elements", () => {
      const html =
        '<p><span class="_idGenCharOverride-1">Content</span></p>';
      const result = cleanHtml(html);

      expect(result).not.toContain("_idGen");
      expect(result).toContain("Content");
    });

    it("should remove empty paragraph elements", () => {
      const html = "<p></p><p>Content</p><p></p>";
      const result = cleanHtml(html);

      expect(result).toBe("<p>Content</p>");
    });

    it("should remove empty span elements", () => {
      const html = "<p><span></span>Text<span></span></p>";
      const result = cleanHtml(html);

      expect(result).toContain("Text");
      // After removing empty spans, should be clean
      expect(result.match(/<span><\/span>/g)).toBeNull();
    });

    it("should remove empty div elements", () => {
      const html = "<div></div><div>Content</div><div></div>";
      const result = cleanHtml(html);

      expect(result).toContain("Content");
    });

    it("should preserve semantic HTML elements", () => {
      const html =
        "<p><strong>Bold</strong> and <em>italic</em></p>";
      const result = cleanHtml(html);

      expect(result).toContain("<strong>Bold</strong>");
      expect(result).toContain("<em>italic</em>");
    });

    it("should preserve links", () => {
      const html =
        '<p>Visit <a href="https://example.com">our site</a></p>';
      const result = cleanHtml(html);

      expect(result).toContain('<a href="https://example.com">');
      expect(result).toContain("our site");
    });

    it("should preserve blockquotes", () => {
      const html = "<blockquote>A quote</blockquote>";
      const result = cleanHtml(html);

      expect(result).toContain("<blockquote>");
      expect(result).toContain("A quote");
    });

    it("should unwrap divs without class or id", () => {
      const html = "<div><p>Content</p></div>";
      const result = cleanHtml(html);

      // The wrapper div should be removed, leaving just the p
      expect(result).toContain("<p>Content</p>");
    });

    it("should keep divs with classes", () => {
      const html = '<div class="important"><p>Content</p></div>';
      const result = cleanHtml(html);

      expect(result).toContain('class="important"');
    });

    it("should clean InDesign classes from elements while keeping semantic ones", () => {
      const html =
        '<p class="Body CharOverride-1 ParaOverride-2">Text</p>';
      const result = cleanHtml(html);

      // The function removes InDesign override classes
      expect(result).not.toContain("CharOverride");
      expect(result).not.toContain("ParaOverride");
      expect(result).toContain("Text");
    });

    it("should normalize whitespace between tags", () => {
      const html = "<p>Hello</p>    \n\n    <p>World</p>";
      const result = cleanHtml(html);

      // Multiple spaces/newlines between tags should be reduced
      expect(result.includes("    ")).toBe(false);
    });

    it("should handle empty input", () => {
      expect(cleanHtml("")).toBe("");
      expect(cleanHtml("   ")).toBe("");
    });

    it("should handle complex nested structures", () => {
      const html = `
        <div>
          <p class="ParaOverride-1">
            <span class="CharOverride-1">
              Hello <strong>world</strong>
            </span>
          </p>
        </div>
      `;
      const result = cleanHtml(html);

      expect(result).toContain("Hello");
      expect(result).toContain("<strong>world</strong>");
      expect(result).not.toContain("CharOverride");
      expect(result).not.toContain("ParaOverride");
    });

    it("should remove recursively emptied elements", () => {
      // After removing inner empty span, outer p becomes empty
      const html =
        '<p><span class="CharOverride-1"></span></p><p>Keep</p>';
      const result = cleanHtml(html);

      expect(result).toBe("<p>Keep</p>");
    });
  });

  describe("htmlToPlainText", () => {
    it("should strip all HTML tags", () => {
      const html = "<p><strong>Hello</strong> world</p>";
      const result = htmlToPlainText(html);

      expect(result).toBe("Hello world");
    });

    it("should handle nested elements", () => {
      const html =
        "<div><p>First</p><p>Second</p></div>";
      const result = htmlToPlainText(html);

      expect(result).toContain("First");
      expect(result).toContain("Second");
    });

    it("should handle empty input", () => {
      expect(htmlToPlainText("")).toBe("");
      expect(htmlToPlainText("   ")).toBe("");
    });

    it("should handle plain text input", () => {
      const result = htmlToPlainText("Just text");
      expect(result).toBe("Just text");
    });

    it("should trim whitespace", () => {
      const html = "  <p>  Spaced  </p>  ";
      const result = htmlToPlainText(html);

      expect(result).toBe("Spaced");
    });
  });

  describe("generateExcerpt", () => {
    it("should return full text if shorter than maxLength", () => {
      const html = "<p>Short text</p>";
      const result = generateExcerpt(html, 150);

      expect(result).toBe("Short text");
    });

    it("should truncate at word boundary", () => {
      const html =
        "<p>This is a longer text that should be truncated at a word boundary</p>";
      const result = generateExcerpt(html, 30);

      expect(result.length).toBeLessThanOrEqual(33); // 30 + "..."
      expect(result.endsWith("...")).toBe(true);
      // Should end with "..." after a complete word, not cut mid-word
      // "This is a longer text that..." = 27 chars + "..." = 30, which is valid
    });

    it("should add ellipsis when truncated", () => {
      const html = "<p>This is a very long text that needs truncation</p>";
      const result = generateExcerpt(html, 20);

      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle empty input", () => {
      expect(generateExcerpt("", 150)).toBe("");
      expect(generateExcerpt("   ", 150)).toBe("");
    });

    it("should use default maxLength of 150", () => {
      const longText =
        "A".repeat(200);
      const result = generateExcerpt(`<p>${longText}</p>`);

      expect(result.length).toBeLessThanOrEqual(153); // 150 + "..."
    });

    it("should handle text exactly at maxLength", () => {
      const text = "Exactly fifteen";
      const result = generateExcerpt(`<p>${text}</p>`, 15);

      expect(result).toBe(text);
      expect(result).not.toContain("...");
    });

    it("should strip HTML before generating excerpt", () => {
      const html =
        "<p><strong>Bold</strong> and <em>italic</em> text here</p>";
      const result = generateExcerpt(html, 150);

      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).toContain("Bold and italic text here");
    });
  });
});
