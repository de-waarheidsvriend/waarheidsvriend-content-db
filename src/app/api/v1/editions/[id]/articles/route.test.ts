import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route
vi.mock("@/lib/db", () => ({
  prisma: {
    edition: {
      findUnique: vi.fn(),
    },
    article: {
      findMany: vi.fn(),
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
  return new NextRequest(`http://localhost:3000/api/v1/editions/${id}/articles`, {
    method: "GET",
    headers,
  });
}

function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/editions/[id]/articles", () => {
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
      expect(json.error.message).toBe("Invalid edition ID");
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

  describe("Edition Not Found", () => {
    it("should return 404 when edition does not exist", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue(null);

      const request = createRequest("999", VALID_API_KEY);
      const response = await GET(request, createParams("999"));
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.error.message).toBe("Edition 999 not found");
    });
  });

  describe("Success Response", () => {
    it("should return empty array when edition has no articles", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it("should return articles with correct format (id as string)", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockResolvedValue([
        {
          id: 1,
          title: "Test Article 1",
          chapeau: "This is the chapeau",
          category: "News",
          page_start: 1,
          page_end: 3,
        },
        {
          id: 2,
          title: "Test Article 2",
          chapeau: null,
          category: null,
          page_start: 4,
          page_end: 5,
        },
      ] as Awaited<ReturnType<typeof prisma.article.findMany>>);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0]).toEqual({
        id: "1",
        title: "Test Article 1",
        chapeau: "This is the chapeau",
        category: "News",
        pageStart: 1,
        pageEnd: 3,
      });
      expect(json.data[1]).toEqual({
        id: "2",
        title: "Test Article 2",
        chapeau: null,
        category: null,
        pageStart: 4,
        pageEnd: 5,
      });
    });

    it("should include all required fields with id as string", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockResolvedValue([
        {
          id: 1,
          title: "Test Article",
          chapeau: "Chapeau text",
          category: "Opinion",
          page_start: 10,
          page_end: 12,
        },
      ] as Awaited<ReturnType<typeof prisma.article.findMany>>);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      const article = json.data[0];
      expect(article).toHaveProperty("id");
      expect(typeof article.id).toBe("string");
      expect(article).toHaveProperty("title");
      expect(article).toHaveProperty("chapeau");
      expect(article).toHaveProperty("category");
      expect(article).toHaveProperty("pageStart");
      expect(article).toHaveProperty("pageEnd");
    });

    it("should query articles ordered by page_start", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      const request = createRequest("42", VALID_API_KEY);
      await GET(request, createParams("42"));

      expect(prisma.article.findMany).toHaveBeenCalledWith({
        where: { edition_id: 42 },
        select: {
          id: true,
          title: true,
          chapeau: true,
          category: true,
          page_start: true,
          page_end: true,
        },
        orderBy: { page_start: "asc" },
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when edition query fails", async () => {
      vi.mocked(prisma.edition.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("Failed to fetch articles");
    });

    it("should return 500 when articles query fails", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("Failed to fetch articles");
    });
  });

  describe("Response Format", () => {
    it("should follow REST conventions with consistent response format", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(typeof json.success).toBe("boolean");
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});
