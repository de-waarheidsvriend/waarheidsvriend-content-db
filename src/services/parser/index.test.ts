import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { XhtmlExport, StyleAnalysis, LoadedSpread } from "@/types";

// Mock all dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  prisma: {
    edition: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    article: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./xhtml-loader", () => ({
  loadXhtmlExport: vi.fn(),
  extractCoverMetadata: vi.fn().mockReturnValue([]),
}));

vi.mock("./article-extractor", () => ({
  extractArticles: vi.fn(),
  saveArticles: vi.fn(),
}));

vi.mock("./author-extractor", () => ({
  extractAuthorsFromArticles: vi.fn(),
  saveAuthors: vi.fn(),
}));

vi.mock("./rich-content-extractor", () => ({
  mapImagesToArticles: vi.fn(),
  saveImages: vi.fn(),
  extractRichContent: vi.fn(),
}));

vi.mock("@/services/pdf", () => ({
  processPdf: vi.fn(),
}));

// Import after mocks are set up
import { processEdition, getEditionProcessingStatus } from "./index";
import { prisma } from "@/lib/db";
import { loadXhtmlExport } from "./xhtml-loader";
import { extractArticles, saveArticles } from "./article-extractor";
import { extractAuthorsFromArticles, saveAuthors } from "./author-extractor";
import { mapImagesToArticles, saveImages } from "./rich-content-extractor";
import { processPdf } from "@/services/pdf";

// Helper to create mock StyleAnalysis
function createMockStyles(): StyleAnalysis {
  return {
    classMap: new Map(),
    articleBoundaryClasses: [],
    titleClasses: ["Titel"],
    chapeauClasses: ["Chapeau"],
    bodyClasses: ["Broodtekst"],
    authorClasses: ["Auteur"],
    categoryClasses: ["Rubriek"],
    subheadingClasses: ["Tussenkop"],
    streamerClasses: ["Streamer"],
    sidebarClasses: ["Kader"],
    captionClasses: ["Bijschrift"],
    coverTitleClasses: [],
    coverChapeauClasses: [],
    introVerseClasses: [],
    authorBioClasses: [],
  };
}

// Helper to create mock spread
function createMockSpread(index: number): LoadedSpread {
  return {
    filename: `publication${index === 0 ? "" : `-${index}`}.html`,
    spreadIndex: index,
    pageStart: index === 0 ? 1 : index * 2,
    pageEnd: index === 0 ? 1 : index * 2 + 1,
    html: "<html><body><p class='Titel'>Test</p></body></html>",
  };
}

// Helper to create mock article with all required fields
function createMockArticle(
  title: string,
  options: {
    chapeau?: string | null;
    content?: string;
    excerpt?: string;
    category?: string | null;
    pageStart?: number;
    pageEnd?: number;
    referencedImages?: string[];
  } = {}
) {
  return {
    title,
    chapeau: options.chapeau ?? null,
    content: options.content ?? `<p>${title} content</p>`,
    excerpt: options.excerpt ?? `${title} excerpt`,
    category: options.category ?? null,
    authorBio: null,
    pageStart: options.pageStart ?? 2,
    pageEnd: options.pageEnd ?? 3,
    sourceSpreadIndexes: [1],
    referencedImages: options.referencedImages ?? [],
    subheadings: [],
    streamers: [],
    sidebars: [],
    captions: new Map(),
    authorNames: [],
    authorPhotoFilenames: new Set<string>(),
  };
}

// Helper to create mock XhtmlExport
function createMockExport(spreadCount: number = 3): XhtmlExport {
  const spreads: LoadedSpread[] = [];
  for (let i = 0; i < spreadCount; i++) {
    spreads.push(createMockSpread(i));
  }
  return {
    rootDir: "/test/export/xhtml",
    spreads,
    images: {
      images: new Map([["test.jpg", "publication-web-resources/image/test.jpg"]]),
      articleImages: ["test.jpg"],
      authorPhotos: [],
      decorativeImages: [],
    },
    styles: createMockStyles(),
    metadata: { editionNumber: 123, editionDate: new Date("2024-01-15") },
    errors: [],
  };
}

describe("Parser Orchestration Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processEdition", () => {
    it("should orchestrate the full processing pipeline successfully", async () => {
      // Setup mocks for successful processing
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
        elapsedMs: 500,
      });

      vi.mocked(loadXhtmlExport).mockResolvedValue(createMockExport(3));

      vi.mocked(extractArticles).mockResolvedValue({
        articles: [
          createMockArticle("Test Article 1", {
            chapeau: "Test chapeau",
            content: "<p>Content 1</p>",
            excerpt: "Content 1",
            category: "Test",
            pageStart: 2,
            pageEnd: 3,
            referencedImages: ["test.jpg"],
          }),
          createMockArticle("Test Article 2", {
            content: "<p>Content 2</p>",
            excerpt: "Content 2",
            pageStart: 4,
            pageEnd: 5,
          }),
        ],
        errors: [],
      });

      vi.mocked(saveArticles).mockResolvedValue({
        articles: [
          { id: 1, edition_id: 1, title: "Test Article 1", chapeau: "Test chapeau", content: "<p>Content 1</p>", excerpt: "Content 1", category: "Test", author_bio: null, page_start: 2, page_end: 3, created_at: new Date(), updated_at: new Date() },
          { id: 2, edition_id: 1, title: "Test Article 2", chapeau: null, content: "<p>Content 2</p>", excerpt: "Content 2", category: null, author_bio: null, page_start: 4, page_end: 5, created_at: new Date(), updated_at: new Date() },
        ],
        errors: [],
      });

      vi.mocked(extractAuthorsFromArticles).mockReturnValue({
        authors: [{ name: "Jan Jansen", photoFilename: null, photoSourcePath: null, articleTitles: ["Test Article 1"] }],
        errors: [],
      });

      vi.mocked(saveAuthors).mockResolvedValue({
        authors: [{ id: 1, name: "Jan Jansen", photo_url: null, created_at: new Date(), updated_at: new Date() }],
        articleAuthorRelations: [{ article_id: 1, author_id: 1 }],
        errors: [],
      });

      vi.mocked(mapImagesToArticles).mockReturnValue({
        images: [{ filename: "test.jpg", sourcePath: "publication-web-resources/image/test.jpg", caption: null, isFeatured: true, sortOrder: 0, articleTitle: "Test Article 1" }],
        errors: [],
      });

      vi.mocked(saveImages).mockResolvedValue({
        images: [{ id: 1, article_id: 1, url: "/uploads/editions/1/images/articles/test.jpg", caption: null, is_featured: true, sort_order: 0, created_at: new Date(), updated_at: new Date() }],
        errors: [],
      });

      vi.mocked(prisma.edition.update).mockResolvedValue({
        id: 1,
        edition_number: 123,
        edition_date: new Date(),
        status: "completed",
        cover_headlines: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
      expect(result.stats.articlesExtracted).toBe(2);
      expect(result.stats.articlesSaved).toBe(2);
      expect(result.stats.authorsExtracted).toBe(1);
      expect(result.stats.authorsSaved).toBe(1);
      expect(result.stats.imagesExtracted).toBe(1);
      expect(result.stats.imagesSaved).toBe(1);
      expect(result.stats.pdfPagesConverted).toBe(24);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);

      // Verify pipeline was called in correct order
      expect(processPdf).toHaveBeenCalledTimes(1);
      expect(loadXhtmlExport).toHaveBeenCalledTimes(1);
      expect(extractArticles).toHaveBeenCalledTimes(1);
      expect(saveArticles).toHaveBeenCalledTimes(1);
      expect(extractAuthorsFromArticles).toHaveBeenCalledTimes(1);
      expect(saveAuthors).toHaveBeenCalledTimes(1);
      expect(mapImagesToArticles).toHaveBeenCalledTimes(1);
      expect(saveImages).toHaveBeenCalledTimes(1);
      expect(prisma.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "completed" },
      });
    });

    it("should handle PDF conversion failure gracefully (non-fatal)", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: false,
        pageCount: 0,
        pageImages: [],
        error: "pdftoppm not installed",
      });

      vi.mocked(loadXhtmlExport).mockResolvedValue(createMockExport(1));

      vi.mocked(extractArticles).mockResolvedValue({
        articles: [createMockArticle("Test Article", { content: "<p>Content</p>", excerpt: "Content" })],
        errors: [],
      });

      vi.mocked(saveArticles).mockResolvedValue({
        articles: [{ id: 1, edition_id: 1, title: "Test Article", chapeau: null, content: "<p>Content</p>", excerpt: "Content", category: null, author_bio: null, page_start: 2, page_end: 3, created_at: new Date(), updated_at: new Date() }],
        errors: [],
      });

      vi.mocked(extractAuthorsFromArticles).mockReturnValue({ authors: [], errors: [] });
      vi.mocked(saveAuthors).mockResolvedValue({ authors: [], articleAuthorRelations: [], errors: [] });
      vi.mocked(mapImagesToArticles).mockReturnValue({ images: [], errors: [] });
      vi.mocked(saveImages).mockResolvedValue({ images: [], errors: [] });
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      // Should complete with warnings (PDF failed but content extracted)
      expect(result.success).toBe(true);
      expect(result.status).toBe("completed_with_errors");
      expect(result.stats.pdfPagesConverted).toBe(0);
      expect(result.stats.articlesSaved).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should fail when no spreads found in XHTML", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
      });

      const emptyExport = createMockExport(0);
      emptyExport.spreads = [];
      vi.mocked(loadXhtmlExport).mockResolvedValue(emptyExport);
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle article extraction errors gracefully", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
      });

      const exportWithErrors = createMockExport(3);
      exportWithErrors.errors = ["CSS file not found"];
      vi.mocked(loadXhtmlExport).mockResolvedValue(exportWithErrors);

      vi.mocked(extractArticles).mockResolvedValue({
        articles: [
          {
            title: "Working Article",
            chapeau: null,
            content: "<p>Content</p>",
            excerpt: "Content",
            category: null,
            pageStart: 2,
            pageEnd: 3,
            sourceSpreadIndexes: [1],
            referencedImages: [],
            subheadings: [],
            streamers: [],
            sidebars: [],
            captions: new Map(),
          },
        ],
        errors: ["Failed to extract article from spread 2: malformed HTML"],
      });

      vi.mocked(saveArticles).mockResolvedValue({
        articles: [{ id: 1, edition_id: 1, title: "Working Article", chapeau: null, content: "<p>Content</p>", excerpt: "Content", category: null, author_bio: null, page_start: 2, page_end: 3, created_at: new Date(), updated_at: new Date() }],
        errors: [],
      });

      vi.mocked(extractAuthorsFromArticles).mockReturnValue({ authors: [], errors: [] });
      vi.mocked(saveAuthors).mockResolvedValue({ authors: [], articleAuthorRelations: [], errors: [] });
      vi.mocked(mapImagesToArticles).mockReturnValue({ images: [], errors: [] });
      vi.mocked(saveImages).mockResolvedValue({ images: [], errors: [] });
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      // Should still succeed with warnings
      expect(result.success).toBe(true);
      expect(result.status).toBe("completed_with_errors");
      expect(result.stats.articlesSaved).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle fatal error during processing", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
      });

      vi.mocked(loadXhtmlExport).mockRejectedValue(new Error("File system error: permission denied"));
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("Fatal error");
    });

    it("should include elapsed time in stats", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
      });

      vi.mocked(loadXhtmlExport).mockResolvedValue(createMockExport(1));

      vi.mocked(extractArticles).mockResolvedValue({
        articles: [],
        errors: [],
      });

      vi.mocked(saveArticles).mockResolvedValue({ articles: [], errors: [] });
      vi.mocked(extractAuthorsFromArticles).mockReturnValue({ authors: [], errors: [] });
      vi.mocked(saveAuthors).mockResolvedValue({ authors: [], articleAuthorRelations: [], errors: [] });
      vi.mocked(mapImagesToArticles).mockReturnValue({ images: [], errors: [] });
      vi.mocked(saveImages).mockResolvedValue({ images: [], errors: [] });
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      expect(result.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("should correctly set status to completed_with_errors when some articles saved despite errors", async () => {
      vi.mocked(processPdf).mockResolvedValue({
        success: true,
        pageCount: 24,
        pageImages: [],
      });

      vi.mocked(loadXhtmlExport).mockResolvedValue(createMockExport(1));

      vi.mocked(extractArticles).mockResolvedValue({
        articles: [createMockArticle("Test Article", { content: "<p>Content</p>", excerpt: "Content" })],
        errors: [],
      });

      // saveArticles fails for some reason
      vi.mocked(saveArticles).mockResolvedValue({
        articles: [{ id: 1, edition_id: 1, title: "Test Article", chapeau: null, content: "<p>Content</p>", excerpt: "Content", category: null, author_bio: null, page_start: 2, page_end: 3, created_at: new Date(), updated_at: new Date() }],
        errors: ["Database timeout on batch insert"],
      });

      vi.mocked(extractAuthorsFromArticles).mockReturnValue({ authors: [], errors: [] });
      vi.mocked(saveAuthors).mockResolvedValue({ authors: [], articleAuthorRelations: [], errors: [] });
      vi.mocked(mapImagesToArticles).mockReturnValue({ images: [], errors: [] });
      vi.mocked(saveImages).mockResolvedValue({ images: [], errors: [] });
      vi.mocked(prisma.edition.update).mockResolvedValue({} as never);

      const result = await processEdition(1, "/test/editions/1", "/test/uploads");

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed_with_errors");
      expect(result.stats.articlesSaved).toBe(1);
    });
  });

  describe("getEditionProcessingStatus", () => {
    it("should return status for existing edition", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({
        id: 1,
        edition_number: 123,
        edition_date: new Date(),
        status: "completed",
        cover_headlines: null,
        created_at: new Date(),
        updated_at: new Date(),
        _count: {
          articles: 15,
          page_images: 24,
        },
      } as never);

      const status = await getEditionProcessingStatus(1);

      expect(status).not.toBeNull();
      expect(status!.status).toBe("completed");
      expect(status!.articleCount).toBe(15);
      expect(status!.imageCount).toBe(24);
    });

    it("should return null for non-existent edition", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue(null);

      const status = await getEditionProcessingStatus(999);

      expect(status).toBeNull();
    });
  });
});
