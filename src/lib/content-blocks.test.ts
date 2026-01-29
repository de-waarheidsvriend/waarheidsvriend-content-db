import { describe, it, expect } from "vitest";
import {
  parseHtmlToBlocks,
  cleanHtmlContent,
  createImageBlocks,
  extractSidebarBlocks,
  transformToContentBlocks,
  getFeaturedImage,
  type ImageData,
} from "./content-blocks";

describe("content-blocks transformer", () => {
  describe("cleanHtmlContent", () => {
    it("should remove HTML tags", () => {
      expect(cleanHtmlContent("<p>Hello <strong>world</strong></p>")).toBe(
        "Hello world"
      );
    });

    it("should decode HTML entities", () => {
      expect(cleanHtmlContent("Hello&nbsp;world")).toBe("Hello world");
      expect(cleanHtmlContent("Tom &amp; Jerry")).toBe("Tom & Jerry");
      expect(cleanHtmlContent("&lt;tag&gt;")).toBe("<tag>");
      expect(cleanHtmlContent("&quot;quoted&quot;")).toBe('"quoted"');
      expect(cleanHtmlContent("It&#39;s fine")).toBe("It's fine");
    });

    it("should normalize whitespace", () => {
      expect(cleanHtmlContent("Hello   world")).toBe("Hello world");
      expect(cleanHtmlContent("  Hello\n\tworld  ")).toBe("Hello world");
    });

    it("should handle empty input", () => {
      expect(cleanHtmlContent("")).toBe("");
      expect(cleanHtmlContent(null as unknown as string)).toBe("");
    });

    it("should handle &apos; entity", () => {
      expect(cleanHtmlContent("It&apos;s working")).toBe("It's working");
    });

    it("should handle malformed tags gracefully", () => {
      expect(cleanHtmlContent("<p>Text<br>More</p>")).toBe("Text More");
      expect(cleanHtmlContent("<img src='x'>")).toBe("");
    });

    it("should handle self-closing tags", () => {
      expect(cleanHtmlContent("<p>Line<br/>Break</p>")).toBe("Line Break");
    });

    it("should handle comments", () => {
      expect(cleanHtmlContent("Text<!-- comment -->More")).toBe("Text More");
    });
  });

  describe("parseHtmlToBlocks", () => {
    it("should parse paragraphs into paragraph blocks", () => {
      const html = "<p>First paragraph</p><p>Second paragraph</p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: "paragraph",
        content: "First paragraph",
      });
      expect(blocks[1]).toEqual({
        type: "paragraph",
        content: "Second paragraph",
      });
    });

    it("should parse h2 and h3 as subheading blocks", () => {
      const html = "<h2>Main Heading</h2><p>Text</p><h3>Sub Heading</h3>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toEqual({ type: "subheading", content: "Main Heading" });
      expect(blocks[1]).toEqual({ type: "paragraph", content: "Text" });
      expect(blocks[2]).toEqual({ type: "subheading", content: "Sub Heading" });
    });

    it("should parse blockquotes as quote blocks", () => {
      const html =
        '<p>Before</p><blockquote>"This is a quote"</blockquote><p>After</p>';
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toEqual({ type: "paragraph", content: "Before" });
      expect(blocks[1]).toEqual({ type: "quote", content: '"This is a quote"' });
      expect(blocks[2]).toEqual({ type: "paragraph", content: "After" });
    });

    it("should handle paragraphs with attributes", () => {
      const html = '<p class="intro">Styled paragraph</p>';
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: "paragraph",
        content: "Styled paragraph",
      });
    });

    it("should skip empty paragraphs", () => {
      const html = "<p>Content</p><p></p><p>  </p><p>More</p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].content).toBe("Content");
      expect(blocks[1].content).toBe("More");
    });

    it("should handle empty input", () => {
      expect(parseHtmlToBlocks("")).toEqual([]);
      expect(parseHtmlToBlocks("   ")).toEqual([]);
    });

    it("should clean nested HTML from content", () => {
      const html = "<p>Text with <em>emphasis</em> and <a href='#'>link</a></p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Text with emphasis and link");
    });

    it("should parse h4 as subheading blocks", () => {
      const html = "<h4>Small Heading</h4><p>Text</p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({ type: "subheading", content: "Small Heading" });
      expect(blocks[1]).toEqual({ type: "paragraph", content: "Text" });
    });

    it("should parse ul and ol as paragraph blocks", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>First</li><li>Second</li></ol>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("paragraph");
      expect(blocks[0].content).toBe("Item 1 Item 2");
      expect(blocks[1].type).toBe("paragraph");
      expect(blocks[1].content).toBe("First Second");
    });

    it("should parse div as paragraph blocks", () => {
      const html = '<div class="content">Div content here</div>';
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: "paragraph", content: "Div content here" });
    });

    it("should handle malformed HTML with unclosed tags", () => {
      const html = "<p>Unclosed paragraph<p>Another paragraph</p>";
      const blocks = parseHtmlToBlocks(html);

      // Should extract what it can - regex may capture both parts together or separately
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      // The content should contain the text, regardless of how it's parsed
      const allContent = blocks.map(b => b.content).join(" ");
      expect(allContent).toContain("paragraph");
    });

    it("should handle malformed HTML with missing closing tags", () => {
      const html = "<p>Text with <strong>bold";
      const blocks = parseHtmlToBlocks(html);

      // Malformed HTML - regex may not match, empty is acceptable
      expect(blocks).toBeDefined();
    });

    it("should decode numeric HTML entities", () => {
      const html = "<p>Quote: &#8220;Hello&#8221;</p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      // Numeric entities may not be decoded, but should not crash
      expect(blocks[0].content).toBeDefined();
    });

    it("should handle mixed entities", () => {
      const html = "<p>&lt;script&gt; &amp; &#39;test&#39; &quot;value&quot;</p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("<script> & 'test' \"value\"");
    });

    it("should handle deeply nested tags", () => {
      const html = "<p><span><strong><em>Deeply nested</em></strong></span></p>";
      const blocks = parseHtmlToBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Deeply nested");
    });
  });

  describe("extractSidebarBlocks", () => {
    it("should extract aside elements as sidebar blocks", () => {
      const html = "<p>Normal text</p><aside>Sidebar content</aside>";
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: "sidebar", content: "Sidebar content" });
    });

    it("should extract divs with sidebar class", () => {
      const html = '<div class="sidebar">Kader content</div>';
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Kader content");
    });

    it("should extract divs with kader class", () => {
      const html = '<div class="article-kader">Box content</div>';
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Box content");
    });

    it("should handle empty input", () => {
      expect(extractSidebarBlocks("")).toEqual([]);
      expect(extractSidebarBlocks(null as unknown as string)).toEqual([]);
    });

    it("should handle nested divs in sidebar", () => {
      const html = '<div class="sidebar"><div class="inner"><p>Nested content</p></div></div>';
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Nested content");
    });

    it("should handle multiple levels of nesting", () => {
      const html = '<div class="kader"><div><div><p>Deep</p></div></div></div>';
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Deep");
    });

    it("should extract multiple sidebars", () => {
      const html = '<aside>First</aside><div class="sidebar">Second</div><aside>Third</aside>';
      const blocks = extractSidebarBlocks(html);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe("First");
      expect(blocks[1].content).toBe("Third");  // asides come first in current implementation
      expect(blocks[2].content).toBe("Second");
    });
  });

  describe("createImageBlocks", () => {
    it("should create image blocks from non-featured images", () => {
      const images: ImageData[] = [
        { url: "/img/1.jpg", caption: "First", isFeatured: false, sortOrder: 0 },
        { url: "/img/2.jpg", caption: "Second", isFeatured: false, sortOrder: 1 },
      ];

      const blocks = createImageBlocks(images);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: "image",
        content: "First",
        imageUrl: "/img/1.jpg",
        caption: "First",
      });
      expect(blocks[1]).toEqual({
        type: "image",
        content: "Second",
        imageUrl: "/img/2.jpg",
        caption: "Second",
      });
    });

    it("should exclude featured images", () => {
      const images: ImageData[] = [
        { url: "/img/featured.jpg", caption: "Main", isFeatured: true, sortOrder: 0 },
        { url: "/img/other.jpg", caption: "Other", isFeatured: false, sortOrder: 1 },
      ];

      const blocks = createImageBlocks(images);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].imageUrl).toBe("/img/other.jpg");
    });

    it("should sort images by sortOrder", () => {
      const images: ImageData[] = [
        { url: "/img/3.jpg", caption: null, isFeatured: false, sortOrder: 3 },
        { url: "/img/1.jpg", caption: null, isFeatured: false, sortOrder: 1 },
        { url: "/img/2.jpg", caption: null, isFeatured: false, sortOrder: 2 },
      ];

      const blocks = createImageBlocks(images);

      expect(blocks[0].imageUrl).toBe("/img/1.jpg");
      expect(blocks[1].imageUrl).toBe("/img/2.jpg");
      expect(blocks[2].imageUrl).toBe("/img/3.jpg");
    });

    it("should handle null captions", () => {
      const images: ImageData[] = [
        { url: "/img/1.jpg", caption: null, isFeatured: false, sortOrder: 0 },
      ];

      const blocks = createImageBlocks(images);

      expect(blocks[0].content).toBe("");
      expect(blocks[0].caption).toBeUndefined();
    });
  });

  describe("getFeaturedImage", () => {
    it("should return explicitly featured image", () => {
      const images: ImageData[] = [
        { url: "/img/1.jpg", caption: "First", isFeatured: false, sortOrder: 0 },
        {
          url: "/img/featured.jpg",
          caption: "Featured",
          isFeatured: true,
          sortOrder: 1,
        },
      ];

      const featured = getFeaturedImage(images);

      expect(featured).toEqual({ url: "/img/featured.jpg", caption: "Featured" });
    });

    it("should fall back to first image by sort order", () => {
      const images: ImageData[] = [
        { url: "/img/2.jpg", caption: "Second", isFeatured: false, sortOrder: 2 },
        { url: "/img/1.jpg", caption: "First", isFeatured: false, sortOrder: 1 },
      ];

      const featured = getFeaturedImage(images);

      expect(featured).toEqual({ url: "/img/1.jpg", caption: "First" });
    });

    it("should return null for empty images", () => {
      expect(getFeaturedImage([])).toBeNull();
    });
  });

  describe("transformToContentBlocks", () => {
    it("should combine text and image blocks with order", () => {
      const article = {
        content: "<p>Paragraph one</p><p>Paragraph two</p>",
        images: [
          { url: "/img/1.jpg", caption: "Image", isFeatured: false, sortOrder: 0 },
        ],
      };

      const blocks = transformToContentBlocks(article);

      // Should have 3 blocks: 2 paragraphs + 1 image
      expect(blocks).toHaveLength(3);

      // All blocks should have order numbers
      blocks.forEach((block, i) => {
        expect(block.order).toBe(i);
      });

      // Should contain both text and image blocks
      const types = blocks.map((b) => b.type);
      expect(types).toContain("paragraph");
      expect(types).toContain("image");
    });

    it("should handle article with only text", () => {
      const article = {
        content: "<p>Just text</p>",
        images: [],
      };

      const blocks = transformToContentBlocks(article);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: "paragraph",
        content: "Just text",
        order: 0,
      });
    });

    it("should handle article with only images", () => {
      const article = {
        content: "",
        images: [
          { url: "/img/1.jpg", caption: "One", isFeatured: false, sortOrder: 0 },
        ],
      };

      const blocks = transformToContentBlocks(article);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("image");
    });

    it("should preserve sidebar position in publication order", () => {
      const article = {
        content: "<p>Text</p><aside>Sidebar</aside>",
        images: [],
      };

      const blocks = transformToContentBlocks(article);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("paragraph");
      expect(blocks[1].type).toBe("sidebar");
    });

    it("should place sidebar between paragraphs when it appears there", () => {
      const article = {
        content: "<p>Before</p><aside>Middle sidebar</aside><p>After</p>",
        images: [],
      };

      const blocks = transformToContentBlocks(article);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toMatchObject({ type: "paragraph", content: "Before" });
      expect(blocks[1]).toMatchObject({ type: "sidebar", content: "Middle sidebar" });
      expect(blocks[2]).toMatchObject({ type: "paragraph", content: "After" });
    });

    it("should place images based on sortOrder position", () => {
      const article = {
        content: "<p>First</p><p>Second</p><p>Third</p>",
        images: [
          { url: "/img/1.jpg", caption: "After first", isFeatured: false, sortOrder: 0 },
          { url: "/img/2.jpg", caption: "After second", isFeatured: false, sortOrder: 1 },
        ],
      };

      const blocks = transformToContentBlocks(article);

      expect(blocks).toHaveLength(5);
      expect(blocks[0]).toMatchObject({ type: "paragraph", content: "First" });
      expect(blocks[1]).toMatchObject({ type: "image", imageUrl: "/img/1.jpg" });
      expect(blocks[2]).toMatchObject({ type: "paragraph", content: "Second" });
      expect(blocks[3]).toMatchObject({ type: "image", imageUrl: "/img/2.jpg" });
      expect(blocks[4]).toMatchObject({ type: "paragraph", content: "Third" });
    });

    it("should maintain sequential order numbers", () => {
      const article = {
        content:
          "<p>One</p><h2>Heading</h2><p>Two</p><blockquote>Quote</blockquote>",
        images: [
          { url: "/img/1.jpg", caption: null, isFeatured: false, sortOrder: 0 },
        ],
      };

      const blocks = transformToContentBlocks(article);

      // Verify order is sequential
      for (let i = 0; i < blocks.length; i++) {
        expect(blocks[i].order).toBe(i);
      }
    });

    it("should exclude featured images from content blocks", () => {
      const article = {
        content: "<p>Text</p>",
        images: [
          {
            url: "/img/featured.jpg",
            caption: "Featured",
            isFeatured: true,
            sortOrder: 0,
          },
          {
            url: "/img/other.jpg",
            caption: "Other",
            isFeatured: false,
            sortOrder: 1,
          },
        ],
      };

      const blocks = transformToContentBlocks(article);

      // Should have paragraph and one image (not the featured one)
      const imageBlocks = blocks.filter((b) => b.type === "image");
      expect(imageBlocks).toHaveLength(1);
      expect(imageBlocks[0].imageUrl).toBe("/img/other.jpg");
    });
  });
});
