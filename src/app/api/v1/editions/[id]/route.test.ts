import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route
vi.mock("@/lib/db", () => ({
  prisma: {
    edition: {
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
  return new NextRequest(`http://localhost:3000/api/v1/editions/${id}`, {
    method: "GET",
    headers,
  });
}

function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/editions/[id]", () => {
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
    it("should return edition with correct format", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({
        id: 1,
        edition_number: 42,
        edition_date: mockDate,
        status: "completed",
        created_at: mockDate,
        updated_at: mockDate,
        _count: { articles: 5 },
      } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        id: 1,
        editionNumber: 42,
        editionDate: "2026-01-15T10:00:00.000Z",
        articleCount: 5,
        status: "completed",
      });
    });

    it("should include all required fields", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({
        id: 1,
        edition_number: 42,
        edition_date: mockDate,
        status: "processing",
        created_at: mockDate,
        updated_at: mockDate,
        _count: { articles: 10 },
      } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json.data).toHaveProperty("id");
      expect(json.data).toHaveProperty("editionNumber");
      expect(json.data).toHaveProperty("editionDate");
      expect(json.data).toHaveProperty("articleCount");
      expect(json.data).toHaveProperty("status");
    });

    it("should query by edition ID", async () => {
      vi.mocked(prisma.edition.findUnique).mockResolvedValue(null);

      const request = createRequest("42", VALID_API_KEY);
      await GET(request, createParams("42"));

      expect(prisma.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
      vi.mocked(prisma.edition.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("Failed to fetch edition");
    });
  });

  describe("Response Format", () => {
    it("should follow REST conventions with consistent response format", async () => {
      const mockDate = new Date("2026-01-15T10:00:00.000Z");
      vi.mocked(prisma.edition.findUnique).mockResolvedValue({
        id: 1,
        edition_number: 42,
        edition_date: mockDate,
        status: "completed",
        created_at: mockDate,
        updated_at: mockDate,
        _count: { articles: 5 },
      } as Awaited<ReturnType<typeof prisma.edition.findUnique>>);

      const request = createRequest("1", VALID_API_KEY);
      const response = await GET(request, createParams("1"));
      const json = await response.json();

      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(typeof json.success).toBe("boolean");
      expect(typeof json.data).toBe("object");
    });
  });
});
