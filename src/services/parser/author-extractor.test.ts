import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractAuthorsFromArticles,
  parseAuthorNames,
  normalizeName,
  matchAuthorPhoto,
  saveAuthors,
} from "./author-extractor";
import type {
  XhtmlExport,
  StyleAnalysis,
  LoadedSpread,
  ExtractedArticle,
  ExtractedAuthor,
} from "@/types";
import type { PrismaClient } from "@prisma/client";

// Create mock Prisma client
function createMockPrisma() {
  return {
    author: {
      upsert: vi.fn(),
    },
    articleAuthor: {
      upsert: vi.fn(),
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
    subheadingClasses: ["Tussenkop"],
    streamerClasses: ["Streamer"],
    sidebarClasses: ["Kader"],
    captionClasses: ["Bijschrift"],
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
  authorPhotos: string[] = [],
  styles?: StyleAnalysis
): XhtmlExport {
  const imageMap = new Map<string, string>();
  for (const photo of authorPhotos) {
    imageMap.set(photo, `publication-web-resources/image/${photo}`);
  }

  return {
    rootDir: "/test/export",
    spreads,
    images: {
      images: imageMap,
      articleImages: [],
      authorPhotos,
      decorativeImages: [],
    },
    styles: styles || createMockStyles(),
    metadata: { editionNumber: 1, editionDate: new Date() },
    errors: [],
  };
}

// Helper to create mock ExtractedArticle
function createMockArticle(
  title: string,
  pageStart: number = 2,
  pageEnd: number = 3,
  authorNames: string[] = []
): ExtractedArticle {
  return {
    title,
    chapeau: null,
    content: "<p>Test content</p>",
    excerpt: "Test excerpt",
    category: null,
    authorBio: null,
    pageStart,
    pageEnd,
    sourceSpreadIndexes: [1],
    referencedImages: [],
    subheadings: [],
    streamers: [],
    sidebars: [],
    captions: new Map<string, string>(),
    authorNames,
    authorPhotoFilenames: new Set<string>(),
  };
}

describe("author-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseAuthorNames", () => {
    it("should parse single author name", () => {
      const result = parseAuthorNames(["Jan Jansen"]);
      expect(result).toEqual(["Jan Jansen"]);
    });

    it("should parse multiple authors separated by 'en'", () => {
      const result = parseAuthorNames(["Jan Jansen en Piet de Vries"]);
      expect(result).toEqual(["Jan Jansen", "Piet de Vries"]);
    });

    it("should parse multiple authors separated by '&'", () => {
      const result = parseAuthorNames(["Jan Jansen & Piet de Vries"]);
      expect(result).toEqual(["Jan Jansen", "Piet de Vries"]);
    });

    it("should parse multiple authors separated by comma", () => {
      const result = parseAuthorNames(["Jan Jansen, Piet de Vries"]);
      expect(result).toEqual(["Jan Jansen", "Piet de Vries"]);
    });

    it("should parse three or more authors", () => {
      const result = parseAuthorNames(["Jan, Piet en Klaas"]);
      expect(result).toEqual(["Jan", "Piet", "Klaas"]);
    });

    it("should handle 'and' separator (English)", () => {
      const result = parseAuthorNames(["John Smith and Jane Doe"]);
      expect(result).toEqual(["John Smith", "Jane Doe"]);
    });

    it("should deduplicate authors from multiple elements", () => {
      const result = parseAuthorNames(["Jan Jansen", "Jan Jansen"]);
      expect(result).toEqual(["Jan Jansen"]);
    });

    it("should handle empty input", () => {
      const result = parseAuthorNames([]);
      expect(result).toEqual([]);
    });

    it("should handle whitespace-only text", () => {
      const result = parseAuthorNames(["   ", "\n\t"]);
      expect(result).toEqual([]);
    });

    it("should trim whitespace from names", () => {
      const result = parseAuthorNames(["  Jan Jansen  "]);
      expect(result).toEqual(["Jan Jansen"]);
    });
  });

  describe("normalizeName", () => {
    it("should trim whitespace", () => {
      expect(normalizeName("  Jan Jansen  ")).toBe("Jan Jansen");
    });

    it("should remove 'Door:' prefix", () => {
      expect(normalizeName("Door: Jan Jansen")).toBe("Jan Jansen");
    });

    it("should remove 'Tekst:' prefix", () => {
      expect(normalizeName("Tekst: Jan Jansen")).toBe("Jan Jansen");
    });

    it("should remove 'by' prefix (English)", () => {
      expect(normalizeName("by John Smith")).toBe("John Smith");
    });

    it("should remove trailing punctuation", () => {
      expect(normalizeName("Jan Jansen.")).toBe("Jan Jansen");
      expect(normalizeName("Jan Jansen,")).toBe("Jan Jansen");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeName("Jan   Jansen")).toBe("Jan Jansen");
    });

    it("should handle prefix case-insensitively", () => {
      expect(normalizeName("DOOR: Jan Jansen")).toBe("Jan Jansen");
      expect(normalizeName("door: Jan Jansen")).toBe("Jan Jansen");
    });
  });

  describe("matchAuthorPhoto", () => {
    it("should match photo by full name", () => {
      const photos = ["jan-jansen.jpg", "other.jpg"];
      const imageMap = new Map([
        ["jan-jansen.jpg", "publication-web-resources/image/jan-jansen.jpg"],
      ]);

      const result = matchAuthorPhoto("Jan Jansen", photos, imageMap);

      expect(result.filename).toBe("jan-jansen.jpg");
      expect(result.sourcePath).toBe(
        "publication-web-resources/image/jan-jansen.jpg"
      );
    });

    it("should match photo by last name only", () => {
      const photos = ["jansen.jpg"];
      const imageMap = new Map([
        ["jansen.jpg", "publication-web-resources/image/jansen.jpg"],
      ]);

      const result = matchAuthorPhoto("Jan Jansen", photos, imageMap);

      expect(result.filename).toBe("jansen.jpg");
    });

    it("should match photo case-insensitively", () => {
      const photos = ["JAN-JANSEN.jpg"];
      const imageMap = new Map([
        ["JAN-JANSEN.jpg", "publication-web-resources/image/JAN-JANSEN.jpg"],
      ]);

      const result = matchAuthorPhoto("jan jansen", photos, imageMap);

      expect(result.filename).toBe("JAN-JANSEN.jpg");
    });

    it("should return null for no matching photos", () => {
      const photos = ["other-author.jpg"];
      const imageMap = new Map([
        ["other-author.jpg", "publication-web-resources/image/other-author.jpg"],
      ]);

      const result = matchAuthorPhoto("Jan Jansen", photos, imageMap);

      expect(result.filename).toBeNull();
      expect(result.sourcePath).toBeNull();
    });

    it("should return null for empty photo list", () => {
      const result = matchAuthorPhoto("Jan Jansen", [], new Map());

      expect(result.filename).toBeNull();
    });

    it("should skip short name parts (initials)", () => {
      const photos = ["j.jpg"]; // Would match "J." initial
      const imageMap = new Map([["j.jpg", "publication-web-resources/image/j.jpg"]]);

      // Should not match because "J" is too short
      const result = matchAuthorPhoto("J. Jansen", photos, imageMap);

      // It should match on "Jansen" instead, but since "j.jpg" doesn't contain "jansen"
      expect(result.filename).toBeNull();
    });

    it("should match any name part as fallback", () => {
      const photos = ["johannes-photo.jpg"];
      const imageMap = new Map([
        ["johannes-photo.jpg", "publication-web-resources/image/johannes-photo.jpg"],
      ]);

      const result = matchAuthorPhoto("Johannes van der Berg", photos, imageMap);

      expect(result.filename).toBe("johannes-photo.jpg");
    });
  });

  describe("extractAuthorsFromArticles", () => {
    it("should extract author from article spread", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Test Article</p>
            <p class="Auteur">Jan Jansen</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      // Author names are pre-extracted during article parsing
      const articles = [createMockArticle("Test Article", 2, 3, ["Jan Jansen"])];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.authors).toHaveLength(1);
      expect(result.authors[0].name).toBe("Jan Jansen");
      expect(result.authors[0].articleTitles).toContain("Test Article");
    });

    it("should extract multiple authors from one article", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Collaboration Article</p>
            <p class="Auteur">Jan Jansen en Piet de Vries</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      // Author names are pre-extracted during article parsing
      const articles = [createMockArticle("Collaboration Article", 2, 3, ["Jan Jansen", "Piet de Vries"])];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread])
      );

      expect(result.authors).toHaveLength(2);
      expect(result.authors.map((a) => a.name)).toContain("Jan Jansen");
      expect(result.authors.map((a) => a.name)).toContain("Piet de Vries");
    });

    it("should link same author to multiple articles", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">First Article</p>
            <p class="Auteur">Jan Jansen</p>
            <p class="Broodtekst">Content 1.</p>
            <p class="Titel">Second Article</p>
            <p class="Auteur">Jan Jansen</p>
            <p class="Broodtekst">Content 2.</p>
          </body>
        </html>
      `
      );
      // Author names are pre-extracted during article parsing
      const articles = [
        createMockArticle("First Article", 2, 3, ["Jan Jansen"]),
        createMockArticle("Second Article", 2, 3, ["Jan Jansen"]),
      ];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread])
      );

      expect(result.authors).toHaveLength(1);
      expect(result.authors[0].articleTitles).toContain("First Article");
      expect(result.authors[0].articleTitles).toContain("Second Article");
    });

    it("should match author photo from image index", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article with Photo</p>
            <p class="Auteur">Jan Jansen</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      // Author names are pre-extracted during article parsing
      const articles = [createMockArticle("Article with Photo", 2, 3, ["Jan Jansen"])];
      const authorPhotos = ["jan-jansen.jpg"];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread], authorPhotos)
      );

      expect(result.authors[0].photoFilename).toBe("jan-jansen.jpg");
      expect(result.authors[0].photoSourcePath).toBe(
        "publication-web-resources/image/jan-jansen.jpg"
      );
    });

    it("should handle articles without author", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">No Author Article</p>
            <p class="Broodtekst">Content here.</p>
          </body>
        </html>
      `
      );
      const articles = [createMockArticle("No Author Article")];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread])
      );

      expect(result.authors).toHaveLength(0);
    });

    it("should handle empty articles array", () => {
      const result = extractAuthorsFromArticles(
        [],
        createMockExport([])
      );

      expect(result.authors).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should use 'Door' class for author extraction", () => {
      const spread = createMockSpread(
        1,
        `
        <html>
          <body>
            <p class="Titel">Article</p>
            <p class="Door">Piet de Vries</p>
            <p class="Broodtekst">Content.</p>
          </body>
        </html>
      `
      );
      // Author names are now pre-extracted during article parsing and passed via authorNames
      const articles = [createMockArticle("Article", 2, 3, ["Piet de Vries"])];

      const result = extractAuthorsFromArticles(
        articles,
        createMockExport([spread])
      );

      expect(result.authors).toHaveLength(1);
      expect(result.authors[0].name).toBe("Piet de Vries");
    });
  });

  describe("saveAuthors", () => {
    it("should upsert author and create article relation", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.author.upsert).mockResolvedValue({
        id: 1,
        name: "Jan Jansen",
        photo_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(mockPrisma.articleAuthor.upsert).mockResolvedValue({
        article_id: 100,
        author_id: 1,
      });

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Test Article"],
        },
      ];

      const articleMap = new Map([["Test Article", 100]]);

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(mockPrisma.author.upsert).toHaveBeenCalledWith({
        where: { name: "Jan Jansen" },
        update: { photo_url: undefined },
        create: { name: "Jan Jansen", photo_url: null },
      });

      expect(mockPrisma.articleAuthor.upsert).toHaveBeenCalled();
      expect(result.authors).toHaveLength(1);
      expect(result.articleAuthorRelations).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle author linked to multiple articles", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.author.upsert).mockResolvedValue({
        id: 1,
        name: "Jan Jansen",
        photo_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(mockPrisma.articleAuthor.upsert).mockResolvedValue({
        article_id: 100,
        author_id: 1,
      });

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Article 1", "Article 2"],
        },
      ];

      const articleMap = new Map([
        ["Article 1", 100],
        ["Article 2", 101],
      ]);

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(mockPrisma.articleAuthor.upsert).toHaveBeenCalledTimes(2);
      expect(result.articleAuthorRelations).toHaveLength(2);
    });

    it("should handle empty authors array", async () => {
      const mockPrisma = createMockPrisma();

      const result = await saveAuthors(
        mockPrisma,
        1,
        [],
        new Map(),
        "/test/export",
        "/uploads"
      );

      expect(result.authors).toHaveLength(0);
      expect(result.articleAuthorRelations).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.author.upsert).not.toHaveBeenCalled();
    });

    it("should warn when article not found in map", async () => {
      const mockPrisma = createMockPrisma();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      vi.mocked(mockPrisma.author.upsert).mockResolvedValue({
        id: 1,
        name: "Jan Jansen",
        photo_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Unknown Article"],
        },
      ];

      const articleMap = new Map(); // Empty map

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No article ID found")
      );
      expect(result.authors).toHaveLength(1);
      expect(result.articleAuthorRelations).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it("should handle database upsert failure gracefully", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.author.upsert).mockRejectedValue(
        new Error("Database connection failed")
      );

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Test Article"],
        },
      ];

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        new Map([["Test Article", 100]]),
        "/test/export",
        "/uploads"
      );

      expect(result.authors).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Failed to save author Jan Jansen");
    });

    it("should handle article relation failure gracefully", async () => {
      const mockPrisma = createMockPrisma();

      vi.mocked(mockPrisma.author.upsert).mockResolvedValue({
        id: 1,
        name: "Jan Jansen",
        photo_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(mockPrisma.articleAuthor.upsert).mockRejectedValue(
        new Error("Foreign key constraint failed")
      );

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Test Article"],
        },
      ];

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        new Map([["Test Article", 100]]),
        "/test/export",
        "/uploads"
      );

      expect(result.authors).toHaveLength(1);
      expect(result.articleAuthorRelations).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Failed to create relation");
    });

    it("should continue processing after individual author failure", async () => {
      const mockPrisma = createMockPrisma();

      // First author fails, second succeeds
      vi.mocked(mockPrisma.author.upsert)
        .mockRejectedValueOnce(new Error("First failed"))
        .mockResolvedValueOnce({
          id: 2,
          name: "Piet de Vries",
          photo_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        });

      vi.mocked(mockPrisma.articleAuthor.upsert).mockResolvedValue({
        article_id: 100,
        author_id: 2,
      });

      const extractedAuthors: ExtractedAuthor[] = [
        {
          name: "Jan Jansen",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Article 1"],
        },
        {
          name: "Piet de Vries",
          photoFilename: null,
          photoSourcePath: null,
          articleTitles: ["Article 2"],
        },
      ];

      const articleMap = new Map([
        ["Article 1", 100],
        ["Article 2", 101],
      ]);

      const result = await saveAuthors(
        mockPrisma,
        1,
        extractedAuthors,
        articleMap,
        "/test/export",
        "/uploads"
      );

      expect(result.authors).toHaveLength(1);
      expect(result.authors[0].name).toBe("Piet de Vries");
      expect(result.errors).toHaveLength(1);
    });
  });
});
