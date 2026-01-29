import { describe, it, expect } from "vitest";
import { mapImagesToArticles, getFeaturedImageUrl } from "./image-mapper";
import type { ExtractedArticle, XhtmlExport, ImageIndex, StyleAnalysis } from "@/types";

// Helper to create a minimal XhtmlExport for testing
function createMockXhtmlExport(
  imageMap: Map<string, string>
): XhtmlExport {
  const emptyStyles: StyleAnalysis = {
    classMap: new Map(),
    articleBoundaryClasses: [],
    titleClasses: [],
    chapeauClasses: [],
    bodyClasses: [],
    authorClasses: [],
    categoryClasses: [],
    subheadingClasses: [],
    streamerClasses: [],
    sidebarClasses: [],
    captionClasses: [],
    coverTitleClasses: [],
    coverChapeauClasses: [],
    introVerseClasses: [],
    authorBioClasses: [],
  };

  const images: ImageIndex = {
    images: imageMap,
    articleImages: Array.from(imageMap.keys()),
    authorPhotos: [],
    decorativeImages: [],
  };

  return {
    rootDir: "/test/xhtml",
    spreads: [],
    images,
    styles: emptyStyles,
    metadata: { editionNumber: null, editionDate: null },
    errors: [],
  };
}

// Helper to create a minimal ExtractedArticle for testing
function createMockArticle(
  title: string,
  referencedImages: string[],
  captions: Map<string, string> = new Map(),
  authorPhotoFilenames: Set<string> = new Set()
): ExtractedArticle {
  return {
    title,
    chapeau: null,
    content: "<p>Test content</p>",
    excerpt: "Test content",
    category: null,
    authorBio: null,
    pageStart: 2,
    pageEnd: 3,
    sourceSpreadIndexes: [1],
    referencedImages,
    subheadings: [],
    streamers: [],
    sidebars: [],
    captions,
    authorNames: [],
    authorPhotoFilenames,
  };
}

describe("mapImagesToArticles", () => {
  it("should map images to articles", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
      ["photo2.jpg", "publication-web-resources/image/photo2.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Test Article", ["photo1.jpg", "photo2.jpg"]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.images[0].filename).toBe("photo1.jpg");
    expect(result.images[0].articleTitle).toBe("Test Article");
    expect(result.images[0].isFeatured).toBe(true);
    expect(result.images[1].isFeatured).toBe(false);
  });

  it("should set first image as featured", () => {
    const imageMap = new Map([
      ["main.jpg", "publication-web-resources/image/main.jpg"],
      ["secondary.jpg", "publication-web-resources/image/secondary.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Test Article", ["main.jpg", "secondary.jpg"]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images[0].isFeatured).toBe(true);
    expect(result.images[0].sortOrder).toBe(0);
    expect(result.images[1].isFeatured).toBe(false);
    expect(result.images[1].sortOrder).toBe(1);
  });

  it("should extract captions from article", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const captions = new Map([["photo1.jpg", "A beautiful sunset"]]);
    const articles = [createMockArticle("Test Article", ["photo1.jpg"], captions)];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images[0].caption).toBe("A beautiful sunset");
  });

  it("should filter out logo and advertisement images", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
      ["logo.png", "publication-web-resources/image/logo.png"],
      ["Adv_sponsor.png", "publication-web-resources/image/Adv_sponsor.png"],
      ["advertentie_1.jpg", "publication-web-resources/image/advertentie_1.jpg"],
      ["icon_share.png", "publication-web-resources/image/icon_share.png"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Test Article", [
        "photo1.jpg",
        "logo.png",
        "Adv_sponsor.png",
        "advertentie_1.jpg",
        "icon_share.png",
      ]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].filename).toBe("photo1.jpg");
  });

  it("should handle missing images in index gracefully", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
      // photo2.jpg is missing from the index
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Test Article", ["photo1.jpg", "photo2.jpg"]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);

    // Should only include photo1.jpg since photo2.jpg is not in index
    expect(result.images).toHaveLength(1);
    expect(result.images[0].filename).toBe("photo1.jpg");
    expect(result.errors).toHaveLength(0); // Just a warning, not an error
  });

  it("should handle multiple articles", () => {
    const imageMap = new Map([
      ["article1-photo.jpg", "publication-web-resources/image/article1-photo.jpg"],
      ["article2-photo.jpg", "publication-web-resources/image/article2-photo.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Article One", ["article1-photo.jpg"]),
      createMockArticle("Article Two", ["article2-photo.jpg"]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images).toHaveLength(2);
    expect(result.images[0].articleTitle).toBe("Article One");
    expect(result.images[1].articleTitle).toBe("Article Two");
  });

  it("should handle articles without images", () => {
    const imageMap = new Map<string, string>();
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [createMockArticle("Test Article", [])];

    const result = mapImagesToArticles(articles, xhtmlExport);

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("getFeaturedImageUrl", () => {
  it("should return featured image URL for article", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
      ["photo2.jpg", "publication-web-resources/image/photo2.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [
      createMockArticle("Test Article", ["photo1.jpg", "photo2.jpg"]),
    ];

    const result = mapImagesToArticles(articles, xhtmlExport);
    const featuredUrl = getFeaturedImageUrl(result.images, "Test Article");

    expect(featuredUrl).toBe("publication-web-resources/image/photo1.jpg");
  });

  it("should return null for article without images", () => {
    const result = getFeaturedImageUrl([], "Test Article");
    expect(result).toBeNull();
  });

  it("should return null for non-existent article", () => {
    const imageMap = new Map([
      ["photo1.jpg", "publication-web-resources/image/photo1.jpg"],
    ]);
    const xhtmlExport = createMockXhtmlExport(imageMap);

    const articles = [createMockArticle("Test Article", ["photo1.jpg"])];

    const result = mapImagesToArticles(articles, xhtmlExport);
    const featuredUrl = getFeaturedImageUrl(result.images, "Non-existent Article");

    expect(featuredUrl).toBeNull();
  });
});
