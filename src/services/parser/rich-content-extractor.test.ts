import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractRichContent,
  mapImagesToArticles,
  extractSubheadings,
  extractStreamers,
  extractSidebars,
  saveImages,
  buildContentBlocks,
  enrichArticleWithRichContent,
} from "./rich-content-extractor";
import type {
  XhtmlExport,
  StyleAnalysis,
  LoadedSpread,
  ExtractedArticle,
  ExtractedImage,
} from "@/types";
import type { PrismaClient } from "@prisma/client";

// Create mock Prisma client
function createMockPrisma() {
  return {
    image: {
      create: vi.fn(),
    },
  } as unknown as PrismaClient;
}

// Helper to create mock StyleAnalysis
function createMockStyles(
  overrides: Partial<StyleAnalysis> = {}
): StyleAnalysis {
  return {
    classMap: new Map(),
    articleBoundaryClasses: [],
    titleClasses: ["Titel", "Hoofdkop"],
    chapeauClasses: ["Chapeau", "Intro"],
    bodyClasses: ["Broodtekst", "Body"],
    authorClasses: ["Auteur", "Door"],
    categoryClasses: ["Rubriek", "Thema"],
    subheadingClasses: ["Tussenkop", "Subhead"],
    streamerClasses: ["Streamer", "Quote"],
    sidebarClasses: ["Kader", "Sidebar"],
    captionClasses: ["Bijschrift", "Caption"],
    coverTitleClasses: [],
    coverChapeauClasses: [],
    introVerseClasses: [],
    authorBioClasses: [],
    ...overrides,
  };
}

// Helper to create mock spread
function createMockSpread(
  index: number,
  html: string,
  pageStart?: number,
  pageEnd?: number
): LoadedSpread {
  return {
    filename: `publication${index === 0 ? "" : `-${index}`}.html`,
    spreadIndex: index,
    pageStart: pageStart ?? (index === 0 ? 1 : index * 2),
    pageEnd: pageEnd ?? (index === 0 ? 1 : index * 2 + 1),
    html,
  };
}

// Helper to create mock XhtmlExport
function createMockExport(
  spreads: LoadedSpread[],
  articleImages: string[] = [],
  authorPhotos: string[] = [],
  decorativeImages: string[] = [],
  styles?: StyleAnalysis
): XhtmlExport {
  const imageMap = new Map<string, string>();
  for (const img of [...articleImages, ...authorPhotos, ...decorativeImages]) {
    imageMap.set(img, `publication-web-resources/image/${img}`);
  }

  return {
    rootDir: "/test/export",
    spreads,
    images: {
      images: imageMap,
      articleImages,
      authorPhotos,
      decorativeImages,
    },
    styles: styles || createMockStyles(),
    metadata: { editionNumber: 1, editionDate: new Date() },
    errors: [],
  };
}

// Helper to create mock ExtractedArticle
function createMockArticle(
  title: string,
  options: Partial<ExtractedArticle> = {}
): ExtractedArticle {
  return {
    title,
    chapeau: null,
    content: "<p>Test content</p>",
    excerpt: "Test excerpt",
    category: null,
    authorBio: null,
    pageStart: 2,
    pageEnd: 3,
    sourceSpreadIndexes: [1],
    referencedImages: [],
    subheadings: [],
    streamers: [],
    sidebars: [],
    captions: new Map(),
    authorNames: [],
    authorPhotoFilenames: new Set<string>(),
    ...options,
  };
}

describe("rich-content-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractSubheadings", () => {
    it("should extract h2 elements", () => {
      const html = `
        <p>Intro text</p>
        <h2>First Subheading</h2>
        <p>More content</p>
        <h2>Second Subheading</h2>
      `;

      const result = extractSubheadings(html);

      expect(result).toHaveLength(2);
      expect(result).toContain("First Subheading");
      expect(result).toContain("Second Subheading");
    });

    it("should extract h3 and h4 elements", () => {
      const html = `
        <h3>H3 Subheading</h3>
        <h4>H4 Subheading</h4>
      `;

      const result = extractSubheadings(html);

      expect(result).toHaveLength(2);
      expect(result).toContain("H3 Subheading");
      expect(result).toContain("H4 Subheading");
    });

    it("should extract elements with tussenkop class", () => {
      const html = `
        <p class="Tussenkop">Dutch Subheading</p>
        <p>Regular text</p>
      `;

      const result = extractSubheadings(html);

      expect(result).toHaveLength(1);
      expect(result).toContain("Dutch Subheading");
    });

    it("should extract elements with subhead class", () => {
      const html = `
        <span class="subhead-large">English Subheading</span>
      `;

      const result = extractSubheadings(html);

      expect(result).toHaveLength(1);
      expect(result).toContain("English Subheading");
    });

    it("should not duplicate subheadings", () => {
      const html = `
        <h2 class="tussenkop">Same Text</h2>
      `;

      const result = extractSubheadings(html);

      // Should only appear once even though it matches both h2 and tussenkop class
      expect(result).toHaveLength(1);
    });

    it("should handle empty HTML", () => {
      expect(extractSubheadings("")).toEqual([]);
      expect(extractSubheadings("   ")).toEqual([]);
    });

    it("should skip empty elements", () => {
      const html = `
        <h2></h2>
        <h2>   </h2>
        <h2>Valid Heading</h2>
      `;

      const result = extractSubheadings(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Valid Heading");
    });
  });

  describe("extractStreamers", () => {
    it("should extract blockquote elements", () => {
      const html = `
        <p>Article text</p>
        <blockquote>This is a pull quote</blockquote>
        <p>More text</p>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("This is a pull quote");
    });

    it("should extract elements with streamer class", () => {
      const html = `
        <p class="Streamer">Dit is een streamer</p>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Dit is een streamer");
    });

    it("should extract elements with quote class", () => {
      const html = `
        <div class="pull-quote">Important quote here</div>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Important quote here");
    });

    it("should extract elements with citaat class (Dutch)", () => {
      const html = `
        <span class="citaat-groot">Nederlands citaat</span>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Nederlands citaat");
    });

    it("should not duplicate streamers", () => {
      const html = `
        <blockquote class="streamer">Same Quote</blockquote>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
    });

    it("should handle empty HTML", () => {
      expect(extractStreamers("")).toEqual([]);
    });

    it("should skip empty elements", () => {
      const html = `
        <blockquote></blockquote>
        <blockquote>Valid Quote</blockquote>
      `;

      const result = extractStreamers(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Valid Quote");
    });
  });

  describe("extractSidebars", () => {
    it("should extract elements with kader class", () => {
      const html = `
        <div class="Kader">
          <p>Sidebar content</p>
        </div>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Sidebar content");
    });

    it("should extract elements with sidebar class", () => {
      const html = `
        <div class="sidebar-info">
          <p>Info box content</p>
        </div>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Info box content");
    });

    it("should extract elements with inzet class", () => {
      const html = `
        <div class="inzet-tekst">
          <p>Inzet content</p>
        </div>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Inzet content");
    });

    it("should extract aside elements", () => {
      const html = `
        <aside>
          <p>Aside content</p>
        </aside>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Aside content");
    });

    it("should clean HTML in sidebars", () => {
      const html = `
        <div class="Kader">
          <p class="CharOverride-1">Content with <span class="_idGenStyle">override</span></p>
        </div>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
      // InDesign-specific classes should be cleaned
      expect(result[0]).not.toContain("CharOverride");
      expect(result[0]).not.toContain("_idGenStyle");
    });

    it("should handle empty HTML", () => {
      expect(extractSidebars("")).toEqual([]);
    });

    it("should not duplicate sidebars", () => {
      const html = `
        <aside class="kader">Same content</aside>
      `;

      const result = extractSidebars(html);

      expect(result).toHaveLength(1);
    });
  });

  describe("extractRichContent", () => {
    it("should extract subheadings from article spreads", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Test Article</p>
            <p class="Tussenkop">A Subheading</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("Test Article")];

      const result = extractRichContent(articles, createMockExport([spread]));

      expect(result.errors).toHaveLength(0);
      expect(result.subheadings).toContain("A Subheading");
    });

    it("should extract streamers from article spreads", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Test Article</p>
            <p class="Streamer">An important quote</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("Test Article")];

      const result = extractRichContent(articles, createMockExport([spread]));

      expect(result.streamers).toContain("An important quote");
    });

    it("should extract sidebars from article spreads", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Test Article</p>
            <div class="Kader">Sidebar info</div>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("Test Article")];

      const result = extractRichContent(articles, createMockExport([spread]));

      expect(result.sidebars).toHaveLength(1);
      expect(result.sidebars[0].type).toBe("sidebar");
    });

    it("should create content blocks in order", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Tussenkop">First Subheading</p>
            <p class="Streamer">A Quote</p>
            <div class="Kader">Sidebar</div>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("Test Article")];

      const result = extractRichContent(articles, createMockExport([spread]));

      expect(result.contentBlocks.length).toBeGreaterThan(0);
      // Check that blocks have sequential order
      const orders = result.contentBlocks.map((b) => b.order);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    it("should deduplicate subheadings and streamers", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Tussenkop">Same Heading</p>
            <p class="Tussenkop">Same Heading</p>
            <p class="Streamer">Same Quote</p>
            <p class="Streamer">Same Quote</p>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("Test Article")];

      const result = extractRichContent(articles, createMockExport([spread]));

      expect(result.subheadings.filter((s) => s === "Same Heading")).toHaveLength(1);
      expect(result.streamers.filter((s) => s === "Same Quote")).toHaveLength(1);
    });

    it("should handle empty articles array", () => {
      const result = extractRichContent([], createMockExport([]));

      expect(result.subheadings).toHaveLength(0);
      expect(result.streamers).toHaveLength(0);
      expect(result.sidebars).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle missing spread gracefully", () => {
      const articles = [
        createMockArticle("Test Article", { sourceSpreadIndexes: [99] }),
      ];

      const result = extractRichContent(articles, createMockExport([]));

      expect(result.errors).toHaveLength(0);
    });
  });

  describe("mapImagesToArticles", () => {
    it("should map referenced images to articles", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const articleImages = ["photo1.jpg", "photo2.jpg"];
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["photo1.jpg", "photo2.jpg"],
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages)
      );

      expect(result.errors).toHaveLength(0);
      expect(result.images).toHaveLength(2);
      expect(result.images[0].articleTitle).toBe("Test Article");
      expect(result.images[1].articleTitle).toBe("Test Article");
    });

    it("should mark first image as featured", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const articleImages = ["photo1.jpg", "photo2.jpg"];
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["photo1.jpg", "photo2.jpg"],
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages)
      );

      expect(result.images[0].isFeatured).toBe(true);
      expect(result.images[0].sortOrder).toBe(0);
      expect(result.images[1].isFeatured).toBe(false);
      expect(result.images[1].sortOrder).toBe(1);
    });

    it("should skip author photos", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const authorPhotos = ["author-jansen.jpg"];
      const articleImages = ["article-photo.jpg"];
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["author-jansen.jpg", "article-photo.jpg"],
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages, authorPhotos)
      );

      expect(result.images).toHaveLength(1);
      expect(result.images[0].filename).toBe("article-photo.jpg");
    });

    it("should skip decorative images", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const decorativeImages = ["logo.png"];
      const articleImages = ["content-photo.jpg"];
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["logo.png", "content-photo.jpg"],
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages, [], decorativeImages)
      );

      expect(result.images).toHaveLength(1);
      expect(result.images[0].filename).toBe("content-photo.jpg");
    });

    it("should extract captions from spreads", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <img src="image/photo.jpg" />
            <p class="Bijschrift">Photo caption text</p>
          </body>
        </html>
      `
      );
      const articleImages = ["photo.jpg"];
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["photo.jpg"],
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages)
      );

      expect(result.images).toHaveLength(1);
      expect(result.images[0].caption).toBe("Photo caption text");
    });

    it("should use article captions if available", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const articleImages = ["photo.jpg"];
      const captions = new Map([["photo.jpg", "Article-level caption"]]);
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["photo.jpg"],
          captions,
        }),
      ];

      const result = mapImagesToArticles(
        articles,
        createMockExport([spread], articleImages)
      );

      expect(result.images).toHaveLength(1);
      expect(result.images[0].caption).toBe("Article-level caption");
    });

    it("should handle image not in index", () => {
      const spread = createMockSpread(1, "<html><body></body></html>");
      const articles = [
        createMockArticle("Test Article", {
          referencedImages: ["missing-image.jpg"],
        }),
      ];

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = mapImagesToArticles(articles, createMockExport([spread]));

      expect(result.images).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image not found in index")
      );

      consoleSpy.mockRestore();
    });

    it("should handle empty articles array", () => {
      const result = mapImagesToArticles([], createMockExport([]));

      expect(result.images).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("saveImages", () => {
    it("should create image records in database", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.image.create).mockResolvedValue({
        id: 1,
        article_id: 100,
        url: "/uploads/editions/1/images/articles/photo.jpg",
        caption: "Test caption",
        is_featured: true,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const extractedImages: ExtractedImage[] = [
        {
          filename: "photo.jpg",
          sourcePath: "publication-web-resources/image/photo.jpg",
          caption: "Test caption",
          isFeatured: true,
          sortOrder: 0,
          articleTitle: "Test Article",
        },
      ];

      const articleMap = new Map([["Test Article", 100]]);

      const result = await saveImages(
        mockPrisma,
        1,
        extractedImages,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(mockPrisma.image.create).toHaveBeenCalled();
      expect(result.images).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle missing article ID", async () => {
      const mockPrisma = createMockPrisma();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const extractedImages: ExtractedImage[] = [
        {
          filename: "photo.jpg",
          sourcePath: "publication-web-resources/image/photo.jpg",
          caption: null,
          isFeatured: true,
          sortOrder: 0,
          articleTitle: "Unknown Article",
        },
      ];

      const articleMap = new Map(); // Empty map

      const result = await saveImages(
        mockPrisma,
        1,
        extractedImages,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(mockPrisma.image.create).not.toHaveBeenCalled();
      expect(result.images).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No article ID found")
      );

      consoleSpy.mockRestore();
    });

    it("should handle empty images array", async () => {
      const mockPrisma = createMockPrisma();

      const result = await saveImages(
        mockPrisma,
        1,
        [],
        new Map(),
        "/test/export",
        "/uploads"
      );

      expect(result.images).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.image.create).not.toHaveBeenCalled();
    });

    it("should handle database create failure gracefully", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.image.create).mockRejectedValue(
        new Error("Database error")
      );

      const extractedImages: ExtractedImage[] = [
        {
          filename: "photo.jpg",
          sourcePath: "publication-web-resources/image/photo.jpg",
          caption: null,
          isFeatured: true,
          sortOrder: 0,
          articleTitle: "Test Article",
        },
      ];

      const articleMap = new Map([["Test Article", 100]]);

      const result = await saveImages(
        mockPrisma,
        1,
        extractedImages,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(result.images).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Failed to save image");
    });

    it("should continue processing after individual failure", async () => {
      const mockPrisma = createMockPrisma();

      // First image fails, second succeeds
      vi.mocked(mockPrisma.image.create)
        .mockRejectedValueOnce(new Error("First failed"))
        .mockResolvedValueOnce({
          id: 2,
          article_id: 101,
          url: "/uploads/editions/1/images/articles/photo2.jpg",
          caption: null,
          is_featured: false,
          sort_order: 1,
          created_at: new Date(),
          updated_at: new Date(),
        });

      const extractedImages: ExtractedImage[] = [
        {
          filename: "photo1.jpg",
          sourcePath: "publication-web-resources/image/photo1.jpg",
          caption: null,
          isFeatured: true,
          sortOrder: 0,
          articleTitle: "Article 1",
        },
        {
          filename: "photo2.jpg",
          sourcePath: "publication-web-resources/image/photo2.jpg",
          caption: null,
          isFeatured: false,
          sortOrder: 1,
          articleTitle: "Article 2",
        },
      ];

      const articleMap = new Map([
        ["Article 1", 100],
        ["Article 2", 101],
      ]);

      const result = await saveImages(
        mockPrisma,
        1,
        extractedImages,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(result.images).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("buildContentBlocks", () => {
    it("should build paragraph blocks from p elements", () => {
      const article = createMockArticle("Test", {
        content: "<p>First paragraph</p><p>Second paragraph</p>",
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("paragraph");
      expect(result[0].content).toBe("First paragraph");
      expect(result[1].type).toBe("paragraph");
      expect(result[1].content).toBe("Second paragraph");
    });

    it("should build subheading blocks from h2/h3 elements", () => {
      const article = createMockArticle("Test", {
        content: "<h2>Heading 2</h2><h3>Heading 3</h3>",
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("subheading");
      expect(result[0].content).toBe("Heading 2");
      expect(result[1].type).toBe("subheading");
      expect(result[1].content).toBe("Heading 3");
    });

    it("should build quote blocks from blockquote elements", () => {
      const article = createMockArticle("Test", {
        content: "<blockquote>A great quote</blockquote>",
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("quote");
      expect(result[0].content).toBe("A great quote");
    });

    it("should build sidebar blocks from aside elements", () => {
      const article = createMockArticle("Test", {
        content: "<aside><p>Sidebar info</p></aside>",
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("sidebar");
    });

    it("should detect elements by class name", () => {
      const article = createMockArticle("Test", {
        content: `
          <p class="tussenkop">Subheading by class</p>
          <div class="streamer">Quote by class</div>
          <div class="kader">Sidebar by class</div>
        `,
      });

      const result = buildContentBlocks(article);

      const types = result.map((b) => b.type);
      expect(types).toContain("subheading");
      expect(types).toContain("quote");
      expect(types).toContain("sidebar");
    });

    it("should maintain order across block types", () => {
      const article = createMockArticle("Test", {
        content: `
          <p>First</p>
          <h2>Heading</h2>
          <blockquote>Quote</blockquote>
          <p>Last</p>
        `,
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(4);
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
      expect(result[3].order).toBe(3);
    });

    it("should handle image elements", () => {
      const article = createMockArticle("Test", {
        content: '<img src="/path/to/image.jpg" alt="Alt text" />',
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("image");
      expect(result[0].imageUrl).toBe("/path/to/image.jpg");
      expect(result[0].content).toBe("Alt text");
    });

    it("should skip empty elements", () => {
      const article = createMockArticle("Test", {
        content: "<p></p><p>   </p><p>Valid content</p>",
      });

      const result = buildContentBlocks(article);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Valid content");
    });
  });

  describe("enrichArticleWithRichContent", () => {
    it("should add subheadings from article content", () => {
      const article = createMockArticle("Test", {
        content: "<h2>Content Subheading</h2><p>Text</p>",
        subheadings: [],
      });

      const result = enrichArticleWithRichContent(article, createMockExport([]));

      expect(result.subheadings).toContain("Content Subheading");
    });

    it("should add streamers from article content", () => {
      const article = createMockArticle("Test", {
        content: "<blockquote>Content Quote</blockquote>",
        streamers: [],
      });

      const result = enrichArticleWithRichContent(article, createMockExport([]));

      expect(result.streamers).toContain("Content Quote");
    });

    it("should add sidebars from article content", () => {
      const article = createMockArticle("Test", {
        content: '<div class="kader">Sidebar content</div>',
        sidebars: [],
      });

      const result = enrichArticleWithRichContent(article, createMockExport([]));

      expect(result.sidebars.length).toBeGreaterThan(0);
    });

    it("should merge with existing subheadings", () => {
      const article = createMockArticle("Test", {
        content: "<h2>New Subheading</h2>",
        subheadings: ["Existing Subheading"],
      });

      const result = enrichArticleWithRichContent(article, createMockExport([]));

      expect(result.subheadings).toContain("Existing Subheading");
      expect(result.subheadings).toContain("New Subheading");
    });

    it("should extract captions from source spreads", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <img src="image/test.jpg" />
            <p class="Bijschrift">Image caption from spread</p>
          </body>
        </html>
      `
      );

      const article = createMockArticle("Test", {
        sourceSpreadIndexes: [1],
        referencedImages: ["test.jpg"],
      });

      const result = enrichArticleWithRichContent(
        article,
        createMockExport([spread], ["test.jpg"])
      );

      expect(result.captions.get("test.jpg")).toBe("Image caption from spread");
    });

    it("should preserve article properties", () => {
      const article = createMockArticle("Test Article", {
        chapeau: "Test chapeau",
        excerpt: "Test excerpt",
        category: "Test category",
        pageStart: 5,
        pageEnd: 7,
      });

      const result = enrichArticleWithRichContent(article, createMockExport([]));

      expect(result.title).toBe("Test Article");
      expect(result.chapeau).toBe("Test chapeau");
      expect(result.excerpt).toBe("Test excerpt");
      expect(result.category).toBe("Test category");
      expect(result.pageStart).toBe(5);
      expect(result.pageEnd).toBe(7);
    });
  });
});
