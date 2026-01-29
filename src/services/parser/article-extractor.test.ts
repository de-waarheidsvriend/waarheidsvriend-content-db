import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractArticles, saveArticles } from "./article-extractor";
import type { XhtmlExport, StyleAnalysis, LoadedSpread } from "@/types";
import type { PrismaClient } from "@prisma/client";

// Create mock Prisma client
function createMockPrisma() {
  return {
    article: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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
    authorClasses: ["Auteur"],
    categoryClasses: ["Rubriek", "Thema"],
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
  styles?: StyleAnalysis
): XhtmlExport {
  return {
    rootDir: "/test/export",
    spreads,
    images: {
      images: new Map(),
      articleImages: [],
      authorPhotos: [],
      decorativeImages: [],
    },
    styles: styles || createMockStyles(),
    metadata: { editionNumber: 1, editionDate: new Date() },
    errors: [],
  };
}

describe("article-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractArticles", () => {
    it("should extract a single article with title and body", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Test Article Title</p>
            <p class="Broodtekst">This is the article body.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.errors).toHaveLength(0);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe("Test Article Title");
      expect(result.articles[0].content).toContain("article body");
    });

    it("should extract article with chapeau", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article With Chapeau</p>
            <p class="Chapeau">This is the chapeau text.</p>
            <p class="Broodtekst">Body content here.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].chapeau).toBe("This is the chapeau text.");
    });

    it("should extract article with category", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Rubriek">Column</p>
            <p class="Titel">Categorized Article</p>
            <p class="Broodtekst">Content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].category).toBe("Column");
    });

    it("should extract multiple articles from one spread", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">First Article</p>
            <p class="Broodtekst">First body.</p>
            <p class="Titel">Second Article</p>
            <p class="Broodtekst">Second body.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].title).toBe("First Article");
      expect(result.articles[1].title).toBe("Second Article");
    });

    it("should extract articles from multiple spreads", async () => {
      const spread1 = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article on Spread 1</p>
            <p class="Broodtekst">Body for spread 1.</p>
          </body>
        </html>
      `
      );
      const spread2 = createMockSpread(
        2,
        `
        <html>
          <body>
            <p class="Titel">Article on Spread 2</p>
            <p class="Broodtekst">Body for spread 2.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(
        createMockExport([spread1, spread2])
      );

      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].title).toBe("Article on Spread 1");
      expect(result.articles[1].title).toBe("Article on Spread 2");
    });

    it("should skip cover spread without articles", async () => {
      const cover = createMockSpread(
        0,
        `
        <html>
          <body>
            <img src="cover.jpg" />
          </body>
        </html>
      `,
        1,
        1
      );
      const spread1 = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Real Article</p>
            <p class="Broodtekst">Body content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([cover, spread1]));

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe("Real Article");
    });

    it("should generate excerpt from body content", async () => {
      const longBody = "A".repeat(200);
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article with Long Body</p>
            <p class="Broodtekst">${longBody}</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].excerpt).not.toBeNull();
      expect(result.articles[0].excerpt!.length).toBeLessThanOrEqual(153);
    });

    it("should set correct page numbers", async () => {
      const spread = createMockSpread(2, `
        <html>
          <body>
            <p class="Titel">Page Numbered Article</p>
            <p class="Broodtekst">Content.</p>
          </body>
        </html>
      `);
      // Spread 2: pages 4-5

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].pageStart).toBe(4);
      expect(result.articles[0].pageEnd).toBe(5);
    });

    it("should track source spread indexes", async () => {
      const spread = createMockSpread(
        3,
        `
        <html>
          <body>
            <p class="Titel">Tracked Article</p>
            <p class="Broodtekst">Content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].sourceSpreadIndexes).toContain(3);
    });

    it("should extract image references", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article with Image</p>
            <img src="../image/photo.jpg" />
            <p class="Broodtekst">Content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].referencedImages).toContain("photo.jpg");
    });

    it("should skip articles without title", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Broodtekst">Orphan body without title.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(0);
    });

    it("should handle empty spreads", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should clean HTML in body content", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Clean HTML Test</p>
            <p class="Broodtekst"><span class="CharOverride-1">Dirty</span> content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].content).not.toContain("CharOverride");
      expect(result.articles[0].content).toContain("Dirty");
    });

    it("should handle alternative class names", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Hoofdkop">Alternative Title Class</p>
            <p class="Intro">Alternative Chapeau</p>
            <p class="Body">Alternative Body</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe("Alternative Title Class");
      expect(result.articles[0].chapeau).toBe("Alternative Chapeau");
    });

    it("should combine multiple body elements", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Multi Paragraph Article</p>
            <p class="Broodtekst">First paragraph.</p>
            <p class="Broodtekst">Second paragraph.</p>
            <p class="Broodtekst">Third paragraph.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      expect(result.articles[0].content).toContain("First paragraph");
      expect(result.articles[0].content).toContain("Second paragraph");
      expect(result.articles[0].content).toContain("Third paragraph");
    });

    it("should handle malformed HTML gracefully", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Malformed Article
            <p class="Broodtekst">Unclosed tags everywhere
          </body>
        </html>
      `
      );

      const result = await extractArticles(createMockExport([spread]));

      // Cheerio is tolerant of malformed HTML
      expect(result.errors).toHaveLength(0);
      expect(result.articles.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle no styles configured", async () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">No Styles</p>
          </body>
        </html>
      `
      );

      const emptyStyles = createMockStyles({
        titleClasses: [],
        chapeauClasses: [],
        bodyClasses: [],
        authorClasses: [],
        categoryClasses: [],
      });

      const result = await extractArticles(
        createMockExport([spread], emptyStyles)
      );

      expect(result.articles).toHaveLength(0);
    });
  });

  describe("multi-spread article detection", () => {
    it("should merge article continuing on next spread without title", async () => {
      const spread1 = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Continued Article</p>
            <p class="Broodtekst">Start of article without ending</p>
          </body>
        </html>
      `
      );
      const spread2 = createMockSpread(
        2,
        `
        <html>
          <body>
            <p class="Broodtekst">Continuation of the article.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(
        createMockExport([spread1, spread2])
      );

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].content).toContain("Start of article");
      expect(result.articles[0].content).toContain("Continuation");
    });

    it("should not merge when next spread has new title", async () => {
      const spread1 = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">First Article</p>
            <p class="Broodtekst">First body content</p>
          </body>
        </html>
      `
      );
      const spread2 = createMockSpread(
        2,
        `
        <html>
          <body>
            <p class="Titel">Second Article</p>
            <p class="Broodtekst">Second body content.</p>
          </body>
        </html>
      `
      );

      const result = await extractArticles(
        createMockExport([spread1, spread2])
      );

      expect(result.articles).toHaveLength(2);
    });

    it("should update page_end for merged articles", async () => {
      const spread1 = createMockSpread(1, `
        <html>
          <body>
            <p class="Titel">Long Article</p>
            <p class="Broodtekst">Start here</p>
          </body>
        </html>
      `); // pages 2-3
      const spread2 = createMockSpread(2, `
        <html>
          <body>
            <p class="Broodtekst">Continues here.</p>
          </body>
        </html>
      `); // pages 4-5

      const result = await extractArticles(
        createMockExport([spread1, spread2])
      );

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].pageStart).toBe(2);
      expect(result.articles[0].pageEnd).toBe(5);
    });

    it("should handle article spanning 3+ spreads", async () => {
      const spreads = [
        createMockSpread(
          1,
          `<html><body>
            <p class="Titel">Very Long Article</p>
            <p class="Broodtekst">Part 1</p>
          </body></html>`
        ),
        createMockSpread(
          2,
          `<html><body>
            <p class="Broodtekst">Part 2</p>
          </body></html>`
        ),
        createMockSpread(
          3,
          `<html><body>
            <p class="Broodtekst">Part 3 ending.</p>
          </body></html>`
        ),
      ];

      const result = await extractArticles(createMockExport(spreads));

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].content).toContain("Part 1");
      expect(result.articles[0].content).toContain("Part 2");
      expect(result.articles[0].content).toContain("Part 3");
      expect(result.articles[0].sourceSpreadIndexes).toContain(1);
      expect(result.articles[0].sourceSpreadIndexes).toContain(2);
      expect(result.articles[0].sourceSpreadIndexes).toContain(3);
    });
  });

  describe("saveArticles", () => {
    it("should save articles to database with correct edition_id", async () => {
      const mockPrisma = createMockPrisma();

      const articles = [
        {
          title: "Test Article",
          chapeau: "Test chapeau",
          content: "<p>Test content</p>",
          excerpt: "Test excerpt",
          category: "Test",
          pageStart: 2,
          pageEnd: 3,
          sourceSpreadIndexes: [1],
          referencedImages: [],
        },
      ];

      vi.mocked(mockPrisma.$transaction).mockResolvedValue([
        {
          id: 1,
          edition_id: 42,
          title: "Test Article",
          chapeau: "Test chapeau",
          content: "<p>Test content</p>",
          excerpt: "Test excerpt",
          category: "Test",
          page_start: 2,
          page_end: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await saveArticles(mockPrisma, 42, articles);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].edition_id).toBe(42);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle multiple articles in bulk", async () => {
      const mockPrisma = createMockPrisma();

      const articles = [
        {
          title: "Article 1",
          chapeau: null,
          content: "Content 1",
          excerpt: "Excerpt 1",
          category: null,
          pageStart: 2,
          pageEnd: 3,
          sourceSpreadIndexes: [1],
          referencedImages: [],
        },
        {
          title: "Article 2",
          chapeau: null,
          content: "Content 2",
          excerpt: "Excerpt 2",
          category: null,
          pageStart: 4,
          pageEnd: 5,
          sourceSpreadIndexes: [2],
          referencedImages: [],
        },
      ];

      vi.mocked(mockPrisma.$transaction).mockResolvedValue([
        {
          id: 1,
          edition_id: 1,
          title: "Article 1",
          chapeau: null,
          content: "Content 1",
          excerpt: "Excerpt 1",
          category: null,
          page_start: 2,
          page_end: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          edition_id: 1,
          title: "Article 2",
          chapeau: null,
          content: "Content 2",
          excerpt: "Excerpt 2",
          category: null,
          page_start: 4,
          page_end: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await saveArticles(mockPrisma, 1, articles);

      expect(result.articles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle empty articles array", async () => {
      const mockPrisma = createMockPrisma();

      const result = await saveArticles(mockPrisma, 1, []);

      expect(result.articles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should handle database transaction failure gracefully", async () => {
      const mockPrisma = createMockPrisma();

      const articles = [
        {
          title: "Test Article",
          chapeau: null,
          content: "Content",
          excerpt: "Excerpt",
          category: null,
          pageStart: 2,
          pageEnd: 3,
          sourceSpreadIndexes: [1],
          referencedImages: [],
        },
      ];

      vi.mocked(mockPrisma.$transaction).mockRejectedValue(
        new Error("Foreign key constraint failed: edition not found")
      );

      const result = await saveArticles(mockPrisma, 999, articles);

      expect(result.articles).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Failed to save articles");
      expect(result.errors[0]).toContain("edition not found");
    });

    it("should handle database connection failure gracefully", async () => {
      const mockPrisma = createMockPrisma();

      const articles = [
        {
          title: "Test Article",
          chapeau: null,
          content: "Content",
          excerpt: "Excerpt",
          category: null,
          pageStart: 2,
          pageEnd: 3,
          sourceSpreadIndexes: [1],
          referencedImages: [],
        },
      ];

      vi.mocked(mockPrisma.$transaction).mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await saveArticles(mockPrisma, 1, articles);

      expect(result.articles).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Connection refused");
    });
  });
});
