import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  processPdf,
  getPageImagesForArticle,
  getPageImagesForEdition,
} from "./index";

// Mock the converter module
vi.mock("./converter", () => ({
  convertPdfToImages: vi.fn(),
  cleanupGeneratedImages: vi.fn(),
  checkPopplerInstalled: vi.fn(),
  getPdfPageCount: vi.fn(),
  validatePdf: vi.fn(),
  getUploadsRoot: vi.fn(() => "/app/uploads"),
  isPathWithinUploads: vi.fn(() => true),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    pageImage: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { convertPdfToImages, cleanupGeneratedImages } from "./converter";
import { prisma } from "@/lib/db";

describe("PDF Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processPdf", () => {
    it("successfully processes PDF and creates database records with createMany", async () => {
      const mockImagePaths = [
        "/app/uploads/editions/1/images/pages/page-1.png",
        "/app/uploads/editions/1/images/pages/page-2.png",
      ];

      vi.mocked(convertPdfToImages).mockResolvedValue({
        success: true,
        pageCount: 2,
        imagePaths: mockImagePaths,
        elapsedMs: 1000,
      });

      // Mock transaction to execute the callback
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          pageImage: {
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(mockTx as Parameters<typeof callback>[0]);
      });

      const result = await processPdf(
        1,
        "/app/uploads/editions/1/pdf/editie.pdf",
        "/app/uploads/editions/1"
      );

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(2);
      expect(result.pageImages).toHaveLength(2);
      expect(result.pageImages[0].pageNumber).toBe(1);
      expect(result.pageImages[1].pageNumber).toBe(2);
      expect(result.elapsedMs).toBe(1000);
      expect(result.error).toBeUndefined();
    });

    it("returns error when PDF conversion fails", async () => {
      vi.mocked(convertPdfToImages).mockResolvedValue({
        success: false,
        pageCount: 0,
        imagePaths: [],
        error: "PDF file not found",
      });

      const result = await processPdf(
        1,
        "/app/uploads/editions/1/pdf/missing.pdf",
        "/app/uploads/editions/1"
      );

      expect(result.success).toBe(false);
      expect(result.pageCount).toBe(0);
      expect(result.pageImages).toHaveLength(0);
      expect(result.error).toBe("PDF file not found");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("uses createMany for efficient bulk insert", async () => {
      vi.mocked(convertPdfToImages).mockResolvedValue({
        success: true,
        pageCount: 3,
        imagePaths: [
          "/app/uploads/editions/1/images/pages/page-1.png",
          "/app/uploads/editions/1/images/pages/page-2.png",
          "/app/uploads/editions/1/images/pages/page-3.png",
        ],
        elapsedMs: 500,
      });

      let capturedData: Array<{ edition_id: number; page_number: number; image_url: string }> = [];
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          pageImage: {
            createMany: vi.fn().mockImplementation((args: { data: typeof capturedData }) => {
              capturedData = args.data;
              return Promise.resolve({ count: args.data.length });
            }),
          },
        };
        return callback(mockTx as Parameters<typeof callback>[0]);
      });

      await processPdf(
        1,
        "/app/uploads/editions/1/pdf/editie.pdf",
        "/app/uploads/editions/1"
      );

      // Verify createMany was called with all records
      expect(capturedData).toHaveLength(3);
      expect(capturedData[0].page_number).toBe(1);
      expect(capturedData[1].page_number).toBe(2);
      expect(capturedData[2].page_number).toBe(3);
    });

    it("cleans up images when database transaction fails", async () => {
      vi.mocked(convertPdfToImages).mockResolvedValue({
        success: true,
        pageCount: 2,
        imagePaths: [
          "/app/uploads/editions/1/images/pages/page-1.png",
          "/app/uploads/editions/1/images/pages/page-2.png",
        ],
        elapsedMs: 500,
      });

      // Make transaction fail
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("Database error"));
      vi.mocked(cleanupGeneratedImages).mockResolvedValue(undefined);

      const result = await processPdf(
        1,
        "/app/uploads/editions/1/pdf/editie.pdf",
        "/app/uploads/editions/1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(cleanupGeneratedImages).toHaveBeenCalledWith(
        expect.stringContaining("editions/1/images/pages")
      );
    });

    it("stores relative path from uploads directory", async () => {
      vi.mocked(convertPdfToImages).mockResolvedValue({
        success: true,
        pageCount: 1,
        imagePaths: ["/app/uploads/editions/42/images/pages/page-1.png"],
        elapsedMs: 500,
      });

      let capturedData: Array<{ edition_id: number; page_number: number; image_url: string }> = [];
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          pageImage: {
            createMany: vi.fn().mockImplementation((args: { data: typeof capturedData }) => {
              capturedData = args.data;
              return Promise.resolve({ count: 1 });
            }),
          },
        };
        return callback(mockTx as Parameters<typeof callback>[0]);
      });

      await processPdf(
        42,
        "/app/uploads/editions/42/pdf/editie.pdf",
        "/app/uploads/editions/42"
      );

      expect(capturedData).toHaveLength(1);
      expect(capturedData[0].image_url).toBe("editions/42/images/pages/page-1.png");
      expect(capturedData[0].edition_id).toBe(42);
      expect(capturedData[0].page_number).toBe(1);
    });
  });

  describe("getPageImagesForArticle", () => {
    it("retrieves page images within article page range", async () => {
      const mockPageImages = [
        { id: 1, edition_id: 1, page_number: 5, image_url: "editions/1/images/pages/page-5.png", created_at: new Date(), updated_at: new Date() },
        { id: 2, edition_id: 1, page_number: 6, image_url: "editions/1/images/pages/page-6.png", created_at: new Date(), updated_at: new Date() },
        { id: 3, edition_id: 1, page_number: 7, image_url: "editions/1/images/pages/page-7.png", created_at: new Date(), updated_at: new Date() },
      ];

      vi.mocked(prisma.pageImage.findMany).mockResolvedValue(mockPageImages);

      const result = await getPageImagesForArticle(1, 5, 7);

      expect(result).toHaveLength(3);
      expect(prisma.pageImage.findMany).toHaveBeenCalledWith({
        where: {
          edition_id: 1,
          page_number: {
            gte: 5,
            lte: 7,
          },
        },
        orderBy: { page_number: "asc" },
      });
    });

    it("returns empty array when no page images in range", async () => {
      vi.mocked(prisma.pageImage.findMany).mockResolvedValue([]);

      const result = await getPageImagesForArticle(1, 100, 110);

      expect(result).toHaveLength(0);
    });

    it("throws error for invalid editionId", async () => {
      await expect(getPageImagesForArticle(0, 1, 5)).rejects.toThrow("editionId must be a positive integer");
      await expect(getPageImagesForArticle(-1, 1, 5)).rejects.toThrow("editionId must be a positive integer");
      await expect(getPageImagesForArticle(1.5, 1, 5)).rejects.toThrow("editionId must be a positive integer");
    });

    it("throws error for invalid pageStart", async () => {
      await expect(getPageImagesForArticle(1, 0, 5)).rejects.toThrow("pageStart must be a positive integer");
      await expect(getPageImagesForArticle(1, -1, 5)).rejects.toThrow("pageStart must be a positive integer");
    });

    it("throws error for invalid pageEnd", async () => {
      await expect(getPageImagesForArticle(1, 1, 0)).rejects.toThrow("pageEnd must be a positive integer");
      await expect(getPageImagesForArticle(1, 1, -1)).rejects.toThrow("pageEnd must be a positive integer");
    });

    it("throws error when pageStart > pageEnd", async () => {
      await expect(getPageImagesForArticle(1, 10, 5)).rejects.toThrow("pageStart must be less than or equal to pageEnd");
    });
  });

  describe("getPageImagesForEdition", () => {
    it("retrieves all page images for an edition", async () => {
      const mockPageImages = [
        { id: 1, edition_id: 1, page_number: 1, image_url: "editions/1/images/pages/page-1.png", created_at: new Date(), updated_at: new Date() },
        { id: 2, edition_id: 1, page_number: 2, image_url: "editions/1/images/pages/page-2.png", created_at: new Date(), updated_at: new Date() },
      ];

      vi.mocked(prisma.pageImage.findMany).mockResolvedValue(mockPageImages);

      const result = await getPageImagesForEdition(1);

      expect(result).toHaveLength(2);
      expect(prisma.pageImage.findMany).toHaveBeenCalledWith({
        where: { edition_id: 1 },
        orderBy: { page_number: "asc" },
      });
    });

    it("returns empty array for edition with no page images", async () => {
      vi.mocked(prisma.pageImage.findMany).mockResolvedValue([]);

      const result = await getPageImagesForEdition(999);

      expect(result).toHaveLength(0);
    });

    it("throws error for invalid editionId", async () => {
      await expect(getPageImagesForEdition(0)).rejects.toThrow("editionId must be a positive integer");
      await expect(getPageImagesForEdition(-1)).rejects.toThrow("editionId must be a positive integer");
      await expect(getPageImagesForEdition(1.5)).rejects.toThrow("editionId must be a positive integer");
    });
  });
});
