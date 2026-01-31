import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route
vi.mock("@/lib/db", () => ({
  prisma: {
    edition: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import after mocks
import { GET } from "./route";
import { prisma } from "@/lib/db";

const VALID_API_KEY = "test-api-key-12345";

function createRequest(apiKey?: string, params?: { page?: number; limit?: number }): NextRequest {
  const headers = new Headers();
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  const url = new URL("http://localhost:3000/api/v1/editions");
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  return new NextRequest(url, {
    method: "GET",
    headers,
  });
}

describe("GET /api/v1/editions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("API_KEY", VALID_API_KEY);
  });

  describe("API Key Validation", () => {
    it("should return 401 when API key is missing", async () => {
      const request = createRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when API key is invalid", async () => {
      const request = createRequest("invalid-key");
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should proceed with valid API key", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(0);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe("Success Response", () => {
    it("should return empty array when no editions exist", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(0);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it("should return editions with correct format (id as string)", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.count).mockResolvedValue(2);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 1,
          edition_number: 42,
          edition_date: mockDate,
          status: "completed",
          created_at: mockDate,
          updated_at: mockDate,
          cover_headlines: null,
          _count: { articles: 5 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
        {
          id: 2,
          edition_number: 41,
          edition_date: new Date("2026-01-08T10:00:00.000Z"),
          status: "processing",
          created_at: mockDate,
          updated_at: mockDate,
          cover_headlines: null,
          _count: { articles: 3 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
      ]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0]).toEqual({
        id: "1",
        editionNumber: 42,
        editionDate: "2026-01-15T10:00:00.000Z",
        articleCount: 5,
        status: "completed",
      });
      expect(json.data[1]).toEqual({
        id: "2",
        editionNumber: 41,
        editionDate: "2026-01-08T10:00:00.000Z",
        articleCount: 3,
        status: "processing",
      });
    });

    it("should include all required fields in response", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.count).mockResolvedValue(1);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 1,
          edition_number: 42,
          edition_date: mockDate,
          status: "completed_with_errors",
          created_at: mockDate,
          updated_at: mockDate,
          cover_headlines: null,
          _count: { articles: 10 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
      ]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      const edition = json.data[0];
      expect(edition).toHaveProperty("id");
      expect(typeof edition.id).toBe("string");
      expect(edition).toHaveProperty("editionNumber");
      expect(edition).toHaveProperty("editionDate");
      expect(edition).toHaveProperty("articleCount");
      expect(edition).toHaveProperty("status");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(0);
      vi.mocked(prisma.edition.findMany).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("Failed to fetch editions");
    });
  });

  describe("Response Format", () => {
    it("should follow REST conventions with consistent response format", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(0);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      // Success response format
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("pagination");
      expect(typeof json.success).toBe("boolean");
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("should order editions by date descending with pagination", async () => {
      const newerDate = new Date("2026-01-22T10:00:00.000Z");
      const olderDate = new Date("2026-01-15T10:00:00.000Z");

      vi.mocked(prisma.edition.count).mockResolvedValue(2);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 2,
          edition_number: 43,
          edition_date: newerDate,
          status: "completed",
          created_at: newerDate,
          updated_at: newerDate,
          cover_headlines: null,
          _count: { articles: 8 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
        {
          id: 1,
          edition_number: 42,
          edition_date: olderDate,
          status: "completed",
          created_at: olderDate,
          updated_at: olderDate,
          cover_headlines: null,
          _count: { articles: 5 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
      ]);

      const request = createRequest(VALID_API_KEY);
      await GET(request);

      expect(prisma.edition.findMany).toHaveBeenCalledWith({
        orderBy: { edition_date: "desc" },
        skip: 0,
        take: 50,
        include: {
          _count: {
            select: { articles: true },
          },
        },
      });
    });
  });

  describe("Pagination", () => {
    it("should return pagination metadata with default values", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(75);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(json.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 75,
        totalPages: 2,
      });
    });

    it("should handle custom page and limit parameters", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(150);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY, { page: 2, limit: 25 });
      const response = await GET(request);
      const json = await response.json();

      expect(json.pagination).toEqual({
        page: 2,
        limit: 25,
        total: 150,
        totalPages: 6,
      });
      expect(prisma.edition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    it("should enforce max limit of 100", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(200);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY, { limit: 500 });
      const response = await GET(request);
      const json = await response.json();

      expect(json.pagination.limit).toBe(100);
      expect(prisma.edition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("should handle page below 1 as page 1", async () => {
      vi.mocked(prisma.edition.count).mockResolvedValue(50);
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY, { page: -1 });
      const response = await GET(request);
      const json = await response.json();

      expect(json.pagination.page).toBe(1);
      expect(prisma.edition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        })
      );
    });
  });
});
