import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route
vi.mock("@/lib/db", () => ({
  prisma: {
    article: {
      findUnique: vi.fn(),
    },
  },
}));

// Import after mocks
import { GET } from "./route";
import { prisma } from "@/lib/db";

const VALID_API_KEY = "test-api-key-12345";

function createRequest(id: string, apiKey?: string): NextRequest {
  const headers = new Headers();
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  return new NextRequest(`http://localhost:3000/api/v1/articles/${id}`, {
    method: "GET",
    headers,
  });
}

function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// Helper to create mock article data
function createMockArticle(overrides = {}) {
  return {
    id: 1,
    edition_id: 1,
    title: "Test Article",
    chapeau: "Test chapeau",
    content: "<p>Test content paragraph</p>",
    excerpt: "Test excerpt",
    category: "Nieuws",
    page_start: 4,
    page_end: 6,
    created_at: new Date(),
    updated_at: new Date(),
    article_authors: [
      {
        article_id: 1,
        author_id: 1,
        author: {
          id: 1,
          name: "Jan Jansen",
          photo_url: "/uploads/authors/jan.jpg",
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
    ],
    images: [
      {
        id: 1,
        article_id: 1,
        url: "/uploads/editions/1/images/article1.jpg",
        caption: "Main image",
        is_featured: true,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    ...overrides,
  };
}

describe("GET /api/v1/articles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("API_KEY", VALID_API_KEY);
  });

  describe("API Key Validation", () => {
    it("should return 401 when API key is missing", async () => {
      const request = createRequest("1");
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when API key is invalid", async () => {
      const request = createRequest("1", "invalid-key");
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("ID Validation", () => {
    it("should return 400 for non-numeric ID", async () => {
      const request = createRequest("abc", VALID_API_KEY);
      const response = await GET(request, createParams("abc"));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toBe("Invalid article ID");
    });

    it("should return 400 for negative ID", async () => {
      const request = createRequest("-1", VALID_API_KEY);
      const response = await GET(request, createParams("-1"));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for zero ID", async () => {
      const request = createRequest("0", VALID_API_KEY);
      const response = await GET(request, createParams("0"));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Article Not Found", () => {
    it("should return 404 when article does not exist", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      const request = createRequest("999", VALID_API_KEY);
      const response = await GET(request, createParams("999"));
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.error.message).toBe("Article 999 not found");
    });
  });

  describe("Success Response", () => {
    it("should return article with correct format (id as string)", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(typeof json.data.id).toBe("string");
      expect(json.data.id).toBe("1");
    });

    it("should include all required fields", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data).toHaveProperty("id");
      expect(json.data).toHaveProperty("title");
      expect(json.data).toHaveProperty("chapeau");
      expect(json.data).toHaveProperty("excerpt");
      expect(json.data).toHaveProperty("category");
      expect(json.data).toHaveProperty("pageStart");
      expect(json.data).toHaveProperty("pageEnd");
      expect(json.data).toHaveProperty("authors");
      expect(json.data).toHaveProperty("featuredImage");
      expect(json.data).toHaveProperty("contentBlocks");
    });

    it("should return article data with correct values", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.title).toBe("Test Article");
      expect(json.data.chapeau).toBe("Test chapeau");
      expect(json.data.excerpt).toBe("Test excerpt");
      expect(json.data.category).toBe("Nieuws");
      expect(json.data.pageStart).toBe(4);
      expect(json.data.pageEnd).toBe(6);
    });
  });

  describe("Authors Inline Format", () => {
    it("should include authors with id, name, and photoUrl", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.authors).toBeInstanceOf(Array);
      expect(json.data.authors).toHaveLength(1);
      expect(json.data.authors[0]).toEqual({
        id: "1",
        name: "Jan Jansen",
        photoUrl: "/uploads/authors/jan.jpg",
      });
    });

    it("should handle multiple authors", async () => {
      const articleWithMultipleAuthors = createMockArticle({
        article_authors: [
          {
            article_id: 1,
            author_id: 1,
            author: {
              id: 1,
              name: "Jan Jansen",
              photo_url: "/uploads/authors/jan.jpg",
              created_at: new Date(),
              updated_at: new Date(),
            },
          },
          {
            article_id: 1,
            author_id: 2,
            author: {
              id: 2,
              name: "Piet Pietersen",
              photo_url: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          },
        ],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithMultipleAuthors as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.authors).toHaveLength(2);
      expect(json.data.authors[1].name).toBe("Piet Pietersen");
      expect(json.data.authors[1].photoUrl).toBeNull();
    });

    it("should handle article without authors", async () => {
      const articleWithoutAuthors = createMockArticle({
        article_authors: [],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithoutAuthors as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.authors).toEqual([]);
    });
  });

  describe("Featured Image Extraction", () => {
    it("should return featured image with url and caption", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.featuredImage).toEqual({
        url: "/uploads/editions/1/images/article1.jpg",
        caption: "Main image",
      });
    });

    it("should use first image by sort_order if no featured flag", async () => {
      const articleWithoutFeatured = createMockArticle({
        images: [
          {
            id: 2,
            article_id: 1,
            url: "/uploads/second.jpg",
            caption: "Second",
            is_featured: false,
            sort_order: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 1,
            article_id: 1,
            url: "/uploads/first.jpg",
            caption: "First",
            is_featured: false,
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithoutFeatured as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      // Should return the one with sort_order=0
      expect(json.data.featuredImage.url).toBe("/uploads/first.jpg");
    });

    it("should return null for article without images", async () => {
      const articleWithoutImages = createMockArticle({
        images: [],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithoutImages as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.featuredImage).toBeNull();
    });
  });

  describe("Content Blocks Structure", () => {
    it("should return contentBlocks as array", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data.contentBlocks).toBeInstanceOf(Array);
    });

    it("should parse content into paragraph blocks", async () => {
      const articleWithContent = createMockArticle({
        content: "<p>First paragraph</p><p>Second paragraph</p>",
        images: [],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithContent as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      const paragraphs = json.data.contentBlocks.filter(
        (b: { type: string }) => b.type === "paragraph"
      );
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });

    it("should include subheading blocks for h2/h3", async () => {
      const articleWithHeadings = createMockArticle({
        content: "<p>Intro</p><h2>Main Section</h2><p>Content</p>",
        images: [],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithHeadings as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      const subheadings = json.data.contentBlocks.filter(
        (b: { type: string }) => b.type === "subheading"
      );
      expect(subheadings).toHaveLength(1);
      expect(subheadings[0].content).toBe("Main Section");
    });

    it("should include quote blocks for blockquotes", async () => {
      const articleWithQuote = createMockArticle({
        content: "<p>Text</p><blockquote>Important quote</blockquote>",
        images: [],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithQuote as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      const quotes = json.data.contentBlocks.filter(
        (b: { type: string }) => b.type === "quote"
      );
      expect(quotes).toHaveLength(1);
      expect(quotes[0].content).toBe("Important quote");
    });

    it("should include image blocks with imageUrl", async () => {
      const articleWithImages = createMockArticle({
        content: "<p>Text</p>",
        images: [
          {
            id: 1,
            article_id: 1,
            url: "/uploads/img1.jpg",
            caption: "Caption 1",
            is_featured: true,
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 2,
            article_id: 1,
            url: "/uploads/img2.jpg",
            caption: "Caption 2",
            is_featured: false,
            sort_order: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithImages as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      // Non-featured image should be in content blocks
      const imageBlocks = json.data.contentBlocks.filter(
        (b: { type: string }) => b.type === "image"
      );
      expect(imageBlocks).toHaveLength(1);
      expect(imageBlocks[0].imageUrl).toBe("/uploads/img2.jpg");
      expect(imageBlocks[0].caption).toBe("Caption 2");
    });

    it("should have sequential order numbers", async () => {
      const articleWithMixedContent = createMockArticle({
        content: "<p>One</p><h2>Two</h2><p>Three</p>",
        images: [
          {
            id: 1,
            article_id: 1,
            url: "/uploads/img.jpg",
            caption: null,
            is_featured: false,
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        articleWithMixedContent as Awaited<
          ReturnType<typeof prisma.article.findUnique>
        >
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      // Verify order is sequential
      for (let i = 0; i < json.data.contentBlocks.length; i++) {
        expect(json.data.contentBlocks[i].order).toBe(i);
      }
    });
  });

  describe("Image URLs Accessibility", () => {
    it("should return direct accessible image URLs", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      // Featured image URL should be a direct path
      expect(json.data.featuredImage.url).toMatch(/^\/uploads\//);

      // Author photo URL should be a direct path
      expect(json.data.authors[0].photoUrl).toMatch(/^\/uploads\//);
    });
  });

  describe("Database Query", () => {
    it("should query by article ID with correct includes", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      const request = createRequest("42", VALID_API_KEY);
      await GET(request, createParams("42"));

      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        include: {
          article_authors: {
            include: {
              author: true,
            },
          },
          images: {
            orderBy: { sort_order: "asc" },
          },
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
      vi.mocked(prisma.article.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("Failed to fetch article");
    });
  });

  describe("Response Format", () => {
    it("should follow REST conventions with consistent response format", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(typeof json.success).toBe("boolean");
      expect(typeof json.data).toBe("object");
    });

    it("should return JSON content type", async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(
        createMockArticle() as Awaited<ReturnType<typeof prisma.article.findUnique>>
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));

      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });
});
