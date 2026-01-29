import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadXhtmlExport, parseSpreadFromFilename } from "./xhtml-loader";
import { readdir, readFile } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Mock the structure-analyzer
vi.mock("./structure-analyzer", () => ({
  analyzeStyles: vi.fn().mockResolvedValue({
    classMap: new Map(),
    articleBoundaryClasses: [],
    titleClasses: [],
    chapeauClasses: [],
    bodyClasses: [],
    authorClasses: [],
    categoryClasses: [],
  }),
  analyzeHtmlClasses: vi.fn().mockResolvedValue({
    classMap: new Map(),
    articleBoundaryClasses: [],
    titleClasses: [],
    chapeauClasses: [],
    bodyClasses: [],
    authorClasses: [],
    categoryClasses: [],
  }),
  mergeStyleAnalysis: vi.fn().mockImplementation((a, b) => ({
    classMap: new Map([...a.classMap, ...b.classMap]),
    articleBoundaryClasses: [...a.articleBoundaryClasses, ...b.articleBoundaryClasses],
    titleClasses: [...a.titleClasses, ...b.titleClasses],
    chapeauClasses: [...a.chapeauClasses, ...b.chapeauClasses],
    bodyClasses: [...a.bodyClasses, ...b.bodyClasses],
    authorClasses: [...a.authorClasses, ...b.authorClasses],
    categoryClasses: [...a.categoryClasses, ...b.categoryClasses],
  })),
}));

// Mock the metadata-extractor
vi.mock("./metadata-extractor", () => ({
  extractMetadata: vi.fn().mockResolvedValue({
    editionNumber: 42,
    editionDate: new Date(2026, 0, 15),
  }),
}));

describe("xhtml-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseSpreadFromFilename", () => {
    it("should parse publication.html as spread 0 (cover, page 1)", () => {
      const result = parseSpreadFromFilename("publication.html");

      expect(result).toEqual({
        filename: "publication.html",
        spreadIndex: 0,
        pageStart: 1,
        pageEnd: 1,
      });
    });

    it("should parse publication-1.html as page 2", () => {
      const result = parseSpreadFromFilename("publication-1.html");

      expect(result).toEqual({
        filename: "publication-1.html",
        spreadIndex: 1,
        pageStart: 2,
        pageEnd: 2,
      });
    });

    it("should parse publication-2.html as page 3", () => {
      const result = parseSpreadFromFilename("publication-2.html");

      expect(result).toEqual({
        filename: "publication-2.html",
        spreadIndex: 2,
        pageStart: 3,
        pageEnd: 3,
      });
    });

    it("should parse publication-10.html as page 11", () => {
      const result = parseSpreadFromFilename("publication-10.html");

      expect(result).toEqual({
        filename: "publication-10.html",
        spreadIndex: 10,
        pageStart: 11,
        pageEnd: 11,
      });
    });

    it("should throw error for unknown filename pattern", () => {
      expect(() => parseSpreadFromFilename("unknown.html")).toThrow(
        "Unknown HTML filename pattern: unknown.html"
      );
    });

    it("should throw error for invalid publication pattern", () => {
      expect(() => parseSpreadFromFilename("publication-abc.html")).toThrow(
        "Unknown HTML filename pattern: publication-abc.html"
      );
    });
  });

  describe("loadXhtmlExport", () => {
    it("should load HTML files from publication-web-resources/html/", async () => {
      // Mock the path resolution - findHtmlDir checks direct path first
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.endsWith("/html")) {
          return ["publication.html", "publication-1.html"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.endsWith("/image")) {
          return ["test-image.jpg"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.endsWith("/css")) {
          return ["idGeneratedStyles.css"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        return [] as unknown as Awaited<ReturnType<typeof readdir>>;
      });

      vi.mocked(readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes("publication.html") && !pathStr.includes("publication-")) {
          return "<html><body>Cover</body></html>";
        }
        if (pathStr.includes("publication-1.html")) {
          return "<html><body>Pages 2-3</body></html>";
        }
        if (pathStr.endsWith(".css")) {
          return ".Titel { font-size: 24px; }";
        }
        return "";
      });

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.spreads).toHaveLength(2);
      expect(result.spreads[0].spreadIndex).toBe(0);
      expect(result.spreads[1].spreadIndex).toBe(1);
    });

    it("should sort spreads by spreadIndex", async () => {
      // Return files in wrong order
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.endsWith("/html")) {
          return [
            "publication-2.html",
            "publication.html",
            "publication-1.html",
          ] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        if (pathStr.endsWith("/image")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        if (pathStr.endsWith("/css")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        return [] as unknown as Awaited<ReturnType<typeof readdir>>;
      });

      vi.mocked(readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes("publication-2.html")) {
          return "<html><body>Spread 2</body></html>";
        }
        if (pathStr.includes("publication.html") && !pathStr.includes("publication-")) {
          return "<html><body>Cover</body></html>";
        }
        if (pathStr.includes("publication-1.html")) {
          return "<html><body>Spread 1</body></html>";
        }
        return "";
      });

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.spreads[0].spreadIndex).toBe(0);
      expect(result.spreads[1].spreadIndex).toBe(1);
      expect(result.spreads[2].spreadIndex).toBe(2);
    });

    it("should handle nested folder structure", async () => {
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        // Direct path fails
        if (pathStr === "./uploads/test/xhtml/publication-web-resources/html") {
          throw new Error("ENOENT");
        }
        // Root returns subfolder
        if (pathStr === "./uploads/test/xhtml") {
          return ["content-folder", "__MACOSX"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        // Nested path succeeds
        if (pathStr.includes("content-folder") && pathStr.endsWith("/html")) {
          return ["publication.html"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.includes("content-folder") && pathStr.endsWith("/image")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        if (pathStr.includes("content-folder") && pathStr.endsWith("/css")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        throw new Error("ENOENT");
      });

      vi.mocked(readFile).mockResolvedValue(
        "<html><body>Content</body></html>"
      );

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.spreads).toHaveLength(1);
    });

    it("should index images from publication-web-resources/image/", async () => {
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.endsWith("/html")) {
          return ["publication.html"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.endsWith("/image")) {
          return [
            "artikel-foto.jpg",
            "auteur-jan.png",
            "logo.gif",
          ] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        if (pathStr.endsWith("/css")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        return [] as unknown as Awaited<ReturnType<typeof readdir>>;
      });

      vi.mocked(readFile).mockResolvedValue(
        "<html><body>Cover</body></html>"
      );

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.images.images.size).toBe(3);
      expect(result.images.articleImages).toContain("artikel-foto.jpg");
      expect(result.images.authorPhotos).toContain("auteur-jan.png");
      expect(result.images.decorativeImages).toContain("logo.gif");
    });

    it("should include metadata from extractMetadata", async () => {
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.endsWith("/html")) {
          return ["publication.html"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.endsWith("/image")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        if (pathStr.endsWith("/css")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        return [] as unknown as Awaited<ReturnType<typeof readdir>>;
      });

      vi.mocked(readFile).mockResolvedValue(
        "<html><body>Cover</body></html>"
      );

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.metadata.editionNumber).toBe(42);
      expect(result.metadata.editionDate).toEqual(new Date(2026, 0, 15));
    });

    it("should handle errors gracefully and continue processing", async () => {
      vi.mocked(readdir).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.endsWith("/html")) {
          return ["publication.html"] as unknown as Awaited<
            ReturnType<typeof readdir>
          >;
        }
        if (pathStr.endsWith("/image")) {
          throw new Error("Image dir not found");
        }
        if (pathStr.endsWith("/css")) {
          return [] as unknown as Awaited<ReturnType<typeof readdir>>;
        }
        return [] as unknown as Awaited<ReturnType<typeof readdir>>;
      });

      vi.mocked(readFile).mockResolvedValue(
        "<html><body>Cover</body></html>"
      );

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      // Should still have spreads and record the error
      expect(result.spreads).toHaveLength(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return empty spreads when HTML directory is not found", async () => {
      vi.mocked(readdir).mockRejectedValue(new Error("ENOENT"));

      const result = await loadXhtmlExport("./uploads/test/xhtml");

      expect(result.spreads).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject paths outside uploads directory (path traversal protection)", async () => {
      const result = await loadXhtmlExport("../../../etc/passwd");

      expect(result.spreads).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("outside the allowed uploads directory");
    });

    it("should reject absolute paths outside uploads", async () => {
      const result = await loadXhtmlExport("/etc/passwd");

      expect(result.spreads).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("outside the allowed uploads directory");
    });
  });
});
