/**
 * Tests for Article Mapper
 *
 * Tests content block → ACF mapping for all block types
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mapContentBlockToAcf,
  generateArticleSlug,
  calculatePublishDate,
  formatEditionDateForWp,
  mapArticleToWpPayload,
  getFeaturedImageUrl,
  transformBlocksToAcfComponents,
  createAuthorBlock,
} from "./article-mapper";
import type { ApiContentBlock } from "@/types/api";
import type { LocalArticleData } from "./types";

describe("mapContentBlockToAcf", () => {
  it("maps paragraph block to text ACF component", () => {
    const block: ApiContentBlock = {
      type: "paragraph",
      content: "Hello world",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "text",
      text_text: "<p>Hello world</p>",
    });
  });

  it("escapes HTML entities in paragraph content", () => {
    const block: ApiContentBlock = {
      type: "paragraph",
      content: "Tom & Jerry <script>alert('xss')</script>",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "text",
      text_text: "<p>Tom &amp; Jerry &lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;</p>",
    });
  });

  it("maps subheading block to text ACF component with h3", () => {
    const block: ApiContentBlock = {
      type: "subheading",
      content: "Section Title",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "text",
      text_text: "<h2>Section Title</h2>",
    });
  });

  it("maps quote block to quote ACF component", () => {
    const block: ApiContentBlock = {
      type: "quote",
      content: "To be or not to be",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "quote",
      quote_text: "To be or not to be",
      quote_author: "",
    });
  });

  it("maps sidebar block to frame ACF component", () => {
    const block: ApiContentBlock = {
      type: "sidebar",
      content: "Related information",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "frame",
      frame_text: "Related information",
    });
  });

  it("maps image block with caption to text component", () => {
    const block: ApiContentBlock = {
      type: "image",
      content: "",
      caption: "Photo by John Doe",
      imageUrl: "/uploads/test.jpg",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "text",
      text_text: "<p class=\"image-caption\"><em>Photo by John Doe</em></p>",
    });
  });

  it("returns null for image block without caption", () => {
    const block: ApiContentBlock = {
      type: "image",
      content: "",
      imageUrl: "/uploads/test.jpg",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toBeNull();
  });
});

describe("generateArticleSlug", () => {
  it("generates slug from title and edition number", () => {
    const result = generateArticleSlug("Hello World", 123);

    expect(result).toBe("hello-world-wv123");
  });

  it("handles Dutch special characters", () => {
    const result = generateArticleSlug("Café naïve", 1);

    expect(result).toBe("cafe-naive-wv1");
  });

  it("removes non-alphanumeric characters", () => {
    const result = generateArticleSlug("Hello! World? (Test)", 1);

    expect(result).toBe("hello-world-test-wv1");
  });

  it("replaces multiple spaces/hyphens with single hyphen", () => {
    const result = generateArticleSlug("Hello    World---Test", 1);

    expect(result).toBe("hello-world-test-wv1");
  });

  it("trims hyphens from start and end", () => {
    const result = generateArticleSlug("  Hello World  ", 1);

    expect(result).toBe("hello-world-wv1");
  });

  it("limits slug length to 60 characters plus suffix", () => {
    const longTitle = "A".repeat(100);
    const result = generateArticleSlug(longTitle, 1);

    // 60 chars + "-wv1" = max length
    expect(result.length).toBeLessThanOrEqual(64);
    expect(result).toMatch(/-wv1$/);
  });
});

describe("calculatePublishDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ISO date string for next Thursday 09:00 NL time", () => {
    // Monday, January 27, 2025, 10:00 UTC
    vi.setSystemTime(new Date("2025-01-27T10:00:00Z"));

    const result = calculatePublishDate();

    // Next Thursday is January 30, 2025
    // 09:00 Amsterdam (CET = UTC+1) = 08:00 UTC
    expect(result).toMatch(/^2025-01-30T0[78]:00:00\.000Z$/);
  });

  it("uses next week Thursday if current day is Thursday after 09:00 NL", () => {
    // Thursday, January 30, 2025, 10:00 Amsterdam (CET) = 09:00 UTC
    vi.setSystemTime(new Date("2025-01-30T09:00:00Z"));

    const result = calculatePublishDate();

    // Should be next Thursday, February 6, 2025
    expect(result).toMatch(/^2025-02-06T0[78]:00:00\.000Z$/);
  });

  it("uses today if it's Thursday before 09:00 NL", () => {
    // Thursday, January 30, 2025, 06:00 Amsterdam (CET) = 05:00 UTC
    vi.setSystemTime(new Date("2025-01-30T05:00:00Z"));

    const result = calculatePublishDate();

    // Should be today, January 30, 2025
    expect(result).toMatch(/^2025-01-30T0[78]:00:00\.000Z$/);
  });
});

describe("formatEditionDateForWp", () => {
  it("formats edition date to ISO string at 09:00 Amsterdam time", () => {
    // January 30, 2026
    const editionDate = new Date("2026-01-30T00:00:00Z");

    const result = formatEditionDateForWp(editionDate);

    // 09:00 Amsterdam (CET = UTC+1) = 08:00 UTC
    expect(result).toMatch(/^2026-01-30T0[78]:00:00\.000Z$/);
  });

  it("handles summer time correctly", () => {
    // June 15, 2026 (summer time: UTC+2)
    const editionDate = new Date("2026-06-15T00:00:00Z");

    const result = formatEditionDateForWp(editionDate);

    // 09:00 Amsterdam (CEST = UTC+2) = 07:00 UTC
    expect(result).toMatch(/^2026-06-15T0[67]:00:00\.000Z$/);
  });
});

describe("mapArticleToWpPayload", () => {
  const baseArticle: LocalArticleData = {
    id: 1,
    title: "Test Article",
    chapeau: "This is the intro",
    excerpt: null,
    content: "<p>Article content here</p>",
    category: "meditation",
    pageStart: 5,
    pageEnd: 7,
    authors: [],
    images: [],
  };

  const editionDate = new Date("2026-01-30T00:00:00Z");

  it("creates basic payload with title and slug", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    expect(result.title).toBe("Test Article");
    expect(result.slug).toBe("test-article");
    expect(result.status).toBe("draft");
  });

  it("uses edition date for publish date", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    // Should be January 30, 2026 at 08:00 UTC (09:00 Amsterdam winter time)
    expect(result.date_gmt).toMatch(/^2026-01-30T0[78]:00:00\.000Z$/);
  });

  it("includes chapeau as article_intro", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    expect(result.acf.article_intro).toBe("This is the intro");
  });

  it("uses excerpt as fallback when chapeau is empty", () => {
    const article = { ...baseArticle, chapeau: null, excerpt: "Excerpt text" };
    const result = mapArticleToWpPayload(article, 123, editionDate);

    expect(result.acf.article_intro).toBe("Excerpt text");
  });

  it("sets article_type to memoriam for memoriam category", () => {
    const article = { ...baseArticle, category: "memoriam" };
    const result = mapArticleToWpPayload(article, 123, editionDate);

    expect(result.acf.article_type).toBe("memoriam");
  });

  it("sets article_type to default for other categories", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    expect(result.acf.article_type).toBe("default");
  });

  it("includes author ID when provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate, 42);

    expect(result.acf.article_author).toBe(42);
  });

  it("includes featured image ID when provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate, undefined, 99);

    expect(result.acf.article_image).toBe(99);
  });

  it("omits article_author when not provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    expect(result.acf.article_author).toBeUndefined();
  });

  it("omits article_image when not provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, editionDate);

    expect(result.acf.article_image).toBeUndefined();
  });
});

describe("getFeaturedImageUrl", () => {
  it("returns URL of explicitly featured image", () => {
    const article: LocalArticleData = {
      id: 1,
      title: "Test",
      chapeau: null,
      excerpt: null,
      content: "",
      category: null,
      pageStart: null,
      pageEnd: null,
      authors: [],
      images: [
        { id: 1, url: "/img1.jpg", caption: null, isFeatured: false, sortOrder: 0 },
        { id: 2, url: "/img2.jpg", caption: null, isFeatured: true, sortOrder: 1 },
      ],
    };

    const result = getFeaturedImageUrl(article);

    expect(result).toBe("/img2.jpg");
  });

  it("returns URL of first image by sort order when no featured", () => {
    const article: LocalArticleData = {
      id: 1,
      title: "Test",
      chapeau: null,
      excerpt: null,
      content: "",
      category: null,
      pageStart: null,
      pageEnd: null,
      authors: [],
      images: [
        { id: 1, url: "/img1.jpg", caption: null, isFeatured: false, sortOrder: 2 },
        { id: 2, url: "/img2.jpg", caption: null, isFeatured: false, sortOrder: 1 },
      ],
    };

    const result = getFeaturedImageUrl(article);

    expect(result).toBe("/img2.jpg");
  });

  it("returns null when no images", () => {
    const article: LocalArticleData = {
      id: 1,
      title: "Test",
      chapeau: null,
      excerpt: null,
      content: "",
      category: null,
      pageStart: null,
      pageEnd: null,
      authors: [],
      images: [],
    };

    const result = getFeaturedImageUrl(article);

    expect(result).toBeNull();
  });
});

describe("transformBlocksToAcfComponents", () => {
  it("combines consecutive paragraphs into single text block", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "First paragraph", order: 0 },
      { type: "paragraph", content: "Second paragraph", order: 1 },
      { type: "paragraph", content: "Third paragraph", order: 2 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    // Should have: 1 text block (before paywall) + paywall + 1 text block (after paywall) = 3
    // But with very short content, paywall goes at end
    const textBlocks = result.filter(c => c.acf_fc_layout === "text");
    const paywallBlocks = result.filter(c => c.acf_fc_layout === "paywall");

    expect(textBlocks.length).toBeLessThanOrEqual(2);
    expect(paywallBlocks.length).toBe(1);
  });

  it("combines subheadings with paragraphs into same text block", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "Intro text", order: 0 },
      { type: "subheading", content: "Section Title", order: 1 },
      { type: "paragraph", content: "Section content", order: 2 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    // Find text blocks
    const textBlocks = result.filter(c => c.acf_fc_layout === "text");

    // First text block should contain both h2 and p tags
    const firstTextBlock = textBlocks[0];
    expect(firstTextBlock).toBeDefined();
    if (firstTextBlock && "text_text" in firstTextBlock) {
      expect(firstTextBlock.text_text).toContain("<h2>");
      expect(firstTextBlock.text_text).toContain("<p>");
    }
  });

  it("renders subheadings as h2 not h3", () => {
    const blocks: ApiContentBlock[] = [
      { type: "subheading", content: "My Heading", order: 0 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const textBlock = result.find(c => c.acf_fc_layout === "text");
    expect(textBlock).toBeDefined();
    if (textBlock && "text_text" in textBlock) {
      expect(textBlock.text_text).toContain("<h2>My Heading</h2>");
      expect(textBlock.text_text).not.toContain("<h3>");
    }
  });

  it("splits text blocks on quote blocks", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "Before quote", order: 0 },
      { type: "quote", content: "A famous quote", order: 1 },
      { type: "paragraph", content: "After quote", order: 2 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const quoteBlocks = result.filter(c => c.acf_fc_layout === "quote");
    expect(quoteBlocks.length).toBe(1);

    // Text blocks should be split around the quote
    const textBlocks = result.filter(c => c.acf_fc_layout === "text");
    expect(textBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it("inserts paywall block", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "Some content", order: 0 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const paywallBlocks = result.filter(c => c.acf_fc_layout === "paywall");
    expect(paywallBlocks.length).toBe(1);
    expect(paywallBlocks[0].acf_fc_layout).toBe("paywall");
  });

  it("text block count equals quotes + 1 (or +2 with paywall split)", () => {
    // Article with 2 quotes and enough content for paywall to split
    const longText = "A".repeat(200); // Long enough to trigger paywall in middle
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: longText, order: 0 },
      { type: "quote", content: "Quote 1", order: 1 },
      { type: "paragraph", content: longText, order: 2 },
      { type: "quote", content: "Quote 2", order: 3 },
      { type: "paragraph", content: longText, order: 4 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const textBlocks = result.filter(c => c.acf_fc_layout === "text");
    const quoteBlocks = result.filter(c => c.acf_fc_layout === "quote");
    const paywallBlocks = result.filter(c => c.acf_fc_layout === "paywall");

    expect(quoteBlocks.length).toBe(2);
    expect(paywallBlocks.length).toBe(1);
    // Text blocks should be quotes + 1 (base) + 1 (paywall split) = 4
    // Or quotes + 1 = 3 if paywall doesn't cause extra split
    expect(textBlocks.length).toBeGreaterThanOrEqual(2 + 1);
    expect(textBlocks.length).toBeLessThanOrEqual(2 + 2);
  });

  it("creates separate frame component for sidebar block", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "Before", order: 0 },
      { type: "sidebar", content: "Kader inhoud", order: 1 },
      { type: "paragraph", content: "After", order: 2 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const frameBlocks = result.filter(c => c.acf_fc_layout === "frame");
    expect(frameBlocks.length).toBe(1);
    expect(frameBlocks[0]).toHaveProperty("frame_text", "Kader inhoud");
  });

  it("splits text blocks around sidebar", () => {
    const blocks: ApiContentBlock[] = [
      { type: "paragraph", content: "Text before", order: 0 },
      { type: "sidebar", content: "Kader", order: 1 },
      { type: "paragraph", content: "Text after", order: 2 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const textBlocks = result.filter(c => c.acf_fc_layout === "text");
    expect(textBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it("sidebar content is not escaped (already HTML)", () => {
    const blocks: ApiContentBlock[] = [
      { type: "sidebar", content: "<p>HTML content</p>", order: 0 },
    ];

    const result = transformBlocksToAcfComponents(blocks);

    const frameBlocks = result.filter(c => c.acf_fc_layout === "frame");
    expect(frameBlocks.length).toBe(1);
    // Content should remain unescaped
    expect(frameBlocks[0]).toHaveProperty("frame_text", "<p>HTML content</p>");
  });
});

describe("createAuthorBlock", () => {
  it("creates text component with author name", () => {
    const result = createAuthorBlock("ds. D.M. Heikoop");

    expect(result.acf_fc_layout).toBe("text");
    expect(result.text_text).toContain("ds. D.M. Heikoop");
    expect(result.text_text).toContain("author-block");
  });

  it("includes photo when provided", () => {
    const result = createAuthorBlock(
      "ds. D.M. Heikoop",
      "https://example.com/photo.jpg"
    );

    expect(result.text_text).toContain("<img");
    expect(result.text_text).toContain("https://example.com/photo.jpg");
    expect(result.text_text).toContain("author-photo");
  });

  it("omits photo img tag when not provided", () => {
    const result = createAuthorBlock("ds. D.M. Heikoop");

    expect(result.text_text).not.toContain("<img");
  });

  it("escapes HTML in author name", () => {
    const result = createAuthorBlock("<script>alert('xss')</script>");

    expect(result.text_text).not.toContain("<script>");
    expect(result.text_text).toContain("&lt;script&gt;");
  });

  it("includes styling for author block", () => {
    const result = createAuthorBlock("Test Author");

    expect(result.text_text).toContain("margin-top:32px");
    expect(result.text_text).toContain("background:#f5f5f5");
    expect(result.text_text).toContain("border-radius:8px");
  });

  it("includes photo styling with rounded appearance", () => {
    const result = createAuthorBlock("Test Author", "https://example.com/photo.jpg");

    expect(result.text_text).toContain("width:80px");
    expect(result.text_text).toContain("height:80px");
    expect(result.text_text).toContain("border-radius:50%");
    expect(result.text_text).toContain("float:left");
  });

  it("includes bio when provided", () => {
    const result = createAuthorBlock(
      "ds. D.M. Heikoop",
      undefined,
      "is predikant te Urk"
    );

    expect(result.text_text).toContain("ds. D.M. Heikoop");
    expect(result.text_text).toContain("is predikant te Urk");
  });

  it("includes both photo and bio when provided", () => {
    const result = createAuthorBlock(
      "ds. D.M. Heikoop",
      "https://example.com/photo.jpg",
      "is predikant te Urk"
    );

    expect(result.text_text).toContain("<img");
    expect(result.text_text).toContain("ds. D.M. Heikoop");
    expect(result.text_text).toContain("is predikant te Urk");
  });

  it("escapes HTML in bio", () => {
    const result = createAuthorBlock(
      "Test Author",
      undefined,
      "<script>alert('xss')</script>"
    );

    expect(result.text_text).not.toContain("<script>");
    expect(result.text_text).toContain("&lt;script&gt;");
  });

  it("handles null bio", () => {
    const result = createAuthorBlock("ds. D.M. Heikoop", undefined, null);

    expect(result.text_text).toContain("ds. D.M. Heikoop");
    expect(result.text_text).not.toContain("null");
  });
});
