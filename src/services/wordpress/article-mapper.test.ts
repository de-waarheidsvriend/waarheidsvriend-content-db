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
  mapArticleToWpPayload,
  getFeaturedImageUrl,
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
      text_text: "<h3>Section Title</h3>",
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

  it("maps sidebar block to text ACF component with sidebar class", () => {
    const block: ApiContentBlock = {
      type: "sidebar",
      content: "Related information",
      order: 0,
    };

    const result = mapContentBlockToAcf(block);

    expect(result).toEqual({
      acf_fc_layout: "text",
      text_text: "<div class=\"sidebar\">Related information</div>",
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates basic payload with title and slug", () => {
    const result = mapArticleToWpPayload(baseArticle, 123);

    expect(result.title).toBe("Test Article");
    expect(result.slug).toBe("test-article-wv123");
    expect(result.status).toBe("draft");
  });

  it("includes chapeau as article_intro", () => {
    const result = mapArticleToWpPayload(baseArticle, 123);

    expect(result.acf.article_intro).toBe("This is the intro");
  });

  it("uses excerpt as fallback when chapeau is empty", () => {
    const article = { ...baseArticle, chapeau: null, excerpt: "Excerpt text" };
    const result = mapArticleToWpPayload(article, 123);

    expect(result.acf.article_intro).toBe("Excerpt text");
  });

  it("sets article_type to memoriam for memoriam category", () => {
    const article = { ...baseArticle, category: "memoriam" };
    const result = mapArticleToWpPayload(article, 123);

    expect(result.acf.article_type).toBe("memoriam");
  });

  it("sets article_type to default for other categories", () => {
    const result = mapArticleToWpPayload(baseArticle, 123);

    expect(result.acf.article_type).toBe("default");
  });

  it("includes author ID when provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, 42);

    expect(result.acf.article_author).toBe(42);
  });

  it("includes featured image ID when provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123, undefined, 99);

    expect(result.acf.article_image).toBe(99);
  });

  it("omits article_author when not provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123);

    expect(result.acf.article_author).toBeUndefined();
  });

  it("omits article_image when not provided", () => {
    const result = mapArticleToWpPayload(baseArticle, 123);

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
