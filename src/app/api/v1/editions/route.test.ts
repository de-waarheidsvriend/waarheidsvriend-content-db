import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route
vi.mock("@/lib/db", () => ({
  prisma: {
    edition: {
      findMany: vi.fn(),
    },
  },
}));

// Import after mocks
import { GET } from "./route";
import { prisma } from "@/lib/db";

const VALID_API_KEY = "test-api-key-12345";

function createRequest(apiKey?: string): NextRequest {
  const headers = new Headers();
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  return new NextRequest("http://localhost:3000/api/v1/editions", {
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
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it("should return editions with correct format", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 1,
          edition_number: 42,
          edition_date: mockDate,
          status: "completed",
          created_at: mockDate,
          updated_at: mockDate,
          _count: { articles: 5 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
        {
          id: 2,
          edition_number: 41,
          edition_date: new Date("2026-01-08T10:00:00.000Z"),
          status: "processing",
          created_at: mockDate,
          updated_at: mockDate,
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
        id: 1,
        editionNumber: 42,
        editionDate: "2026-01-15T10:00:00.000Z",
        articleCount: 5,
        status: "completed",
      });
      expect(json.data[1]).toEqual({
        id: 2,
        editionNumber: 41,
        editionDate: "2026-01-08T10:00:00.000Z",
        articleCount: 3,
        status: "processing",
      });
    });

    it("should include all required fields in response", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 1,
          edition_number: 42,
          edition_date: mockDate,
          status: "completed_with_errors",
          created_at: mockDate,
          updated_at: mockDate,
          _count: { articles: 10 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
      ]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      const edition = json.data[0];
      expect(edition).toHaveProperty("id");
      expect(edition).toHaveProperty("editionNumber");
      expect(edition).toHaveProperty("editionDate");
      expect(edition).toHaveProperty("articleCount");
      expect(edition).toHaveProperty("status");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
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
      vi.mocked(prisma.edition.findMany).mockResolvedValue([]);

      const request = createRequest(VALID_API_KEY);
      const response = await GET(request);
      const json = await response.json();

      // Success response format
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(typeof json.success).toBe("boolean");
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("should order editions by date descending", async () => {
      const newerDate = new Date("2026-01-22T10:00:00.000Z");
      const olderDate = new Date("2026-01-15T10:00:00.000Z");

      vi.mocked(prisma.edition.findMany).mockResolvedValue([
        {
          id: 2,
          edition_number: 43,
          edition_date: newerDate,
          status: "completed",
          created_at: newerDate,
          updated_at: newerDate,
          _count: { articles: 8 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
        {
          id: 1,
          edition_number: 42,
          edition_date: olderDate,
          status: "completed",
          created_at: olderDate,
          updated_at: olderDate,
          _count: { articles: 5 },
        } as Awaited<ReturnType<typeof prisma.edition.findMany>>[0],
      ]);

      const request = createRequest(VALID_API_KEY);
      await GET(request);

      expect(prisma.edition.findMany).toHaveBeenCalledWith({
        orderBy: { edition_date: "desc" },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      });
    });
  });
});
