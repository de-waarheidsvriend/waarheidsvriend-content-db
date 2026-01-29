import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "child_process";
import * as fsPromises from "fs/promises";
import {
  checkPopplerInstalled,
  getPdfPageCount,
  validatePdf,
  convertPdfToImages,
  cleanupGeneratedImages,
  isPathWithinUploads,
  getUploadsRoot,
} from "./converter";

// Mock child_process
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
}));

// Helper to create a mock execFile that works with promisify
function mockExecFile(
  implementation: (
    command: string,
    args: string[]
  ) => { stdout: string; stderr: string } | Error
) {
  const mockFn = vi.mocked(childProcess.execFile);
  mockFn.mockImplementation(((
    command: string,
    args: string[],
    callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
  ) => {
    if (callback) {
      try {
        const result = implementation(command, args);
        if (result instanceof Error) {
          callback(result, { stdout: "", stderr: "" });
        } else {
          callback(null, result);
        }
      } catch (error) {
        callback(error as Error, { stdout: "", stderr: "" });
      }
    }
    return {} as ReturnType<typeof childProcess.execFile>;
  }) as typeof childProcess.execFile);
}

describe("PDF Converter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set uploads root for tests
    process.env.UPLOADS_ROOT = "/app/uploads";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.UPLOADS_ROOT;
  });

  describe("getUploadsRoot", () => {
    it("returns UPLOADS_ROOT env var when set", () => {
      process.env.UPLOADS_ROOT = "/custom/uploads";
      expect(getUploadsRoot()).toBe("/custom/uploads");
    });

    it("falls back to cwd/uploads when env var not set", () => {
      delete process.env.UPLOADS_ROOT;
      expect(getUploadsRoot()).toContain("uploads");
    });
  });

  describe("isPathWithinUploads", () => {
    it("returns true for path within uploads", () => {
      process.env.UPLOADS_ROOT = "/app/uploads";
      expect(isPathWithinUploads("/app/uploads/editions/1/pdf/test.pdf")).toBe(true);
    });

    it("returns false for path outside uploads", () => {
      process.env.UPLOADS_ROOT = "/app/uploads";
      expect(isPathWithinUploads("/etc/passwd")).toBe(false);
    });

    it("returns false for path traversal attempt", () => {
      process.env.UPLOADS_ROOT = "/app/uploads";
      expect(isPathWithinUploads("/app/uploads/../../../etc/passwd")).toBe(false);
    });
  });

  describe("checkPopplerInstalled", () => {
    it("returns true when pdftoppm is available", async () => {
      mockExecFile((command, args) => {
        if (command === "which" && args[0] === "pdftoppm") {
          return { stdout: "/usr/bin/pdftoppm\n", stderr: "" };
        }
        throw new Error("Unexpected command");
      });

      const result = await checkPopplerInstalled();
      expect(result).toBe(true);
    });

    it("returns false when pdftoppm is not available", async () => {
      mockExecFile(() => {
        throw new Error("not found");
      });

      const result = await checkPopplerInstalled();
      expect(result).toBe(false);
    });
  });

  describe("getPdfPageCount", () => {
    it("returns page count from pdfinfo output", async () => {
      mockExecFile((command, args) => {
        if (command === "pdfinfo" && args[0] === "/app/uploads/test.pdf") {
          return {
            stdout: "Title: Test\nPages:          24\nOther: data",
            stderr: "",
          };
        }
        throw new Error("Unexpected command");
      });

      const result = await getPdfPageCount("/app/uploads/test.pdf");
      expect(result).toBe(24);
    });

    it("returns 0 for invalid PDF", async () => {
      mockExecFile(() => {
        throw new Error("PDF error");
      });

      const result = await getPdfPageCount("/app/uploads/invalid.pdf");
      expect(result).toBe(0);
    });

    it("returns 0 for path outside uploads", async () => {
      const result = await getPdfPageCount("/etc/passwd");
      expect(result).toBe(0);
    });
  });

  describe("validatePdf", () => {
    it("returns true for valid PDF within uploads", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      mockExecFile((command, args) => {
        if (command === "pdfinfo" && args[0] === "/app/uploads/valid.pdf") {
          return { stdout: "Title: Test PDF\nPages: 5\n", stderr: "" };
        }
        throw new Error("Unexpected command");
      });

      const result = await validatePdf("/app/uploads/valid.pdf");
      expect(result).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith("/app/uploads/valid.pdf");
    });

    it("returns false for non-existent file", async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

      const result = await validatePdf("/app/uploads/nonexistent.pdf");
      expect(result).toBe(false);
    });

    it("returns false for corrupt PDF", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      mockExecFile(() => {
        throw new Error("PDF is corrupted");
      });

      const result = await validatePdf("/app/uploads/corrupt.pdf");
      expect(result).toBe(false);
    });

    it("returns false for path outside uploads directory", async () => {
      const result = await validatePdf("/etc/passwd");
      expect(result).toBe(false);
      expect(fsPromises.access).not.toHaveBeenCalled();
    });
  });

  describe("convertPdfToImages", () => {
    it("successfully converts PDF to images", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readdir).mockResolvedValue([
        "page-1.png",
        "page-2.png",
        "page-3.png",
      ] as unknown as fsPromises.Dirent[]);

      mockExecFile((command, args) => {
        if (command === "pdfinfo") {
          return { stdout: "Pages: 3\n", stderr: "" };
        }
        if (command === "which") {
          return { stdout: "/usr/bin/pdftoppm\n", stderr: "" };
        }
        if (command === "pdftoppm") {
          expect(args).toContain("-png");
          expect(args).toContain("-r");
          expect(args).toContain("150");
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await convertPdfToImages(
        "/app/uploads/test.pdf",
        "/app/uploads/output"
      );

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(3);
      expect(result.imagePaths).toHaveLength(3);
      expect(result.imagePaths[0]).toContain("page-1.png");
      expect(result.error).toBeUndefined();
    });

    it("returns error for path outside uploads directory", async () => {
      const result = await convertPdfToImages(
        "/etc/passwd",
        "/app/uploads/output"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("outside allowed directory");
    });

    it("returns error for output directory outside uploads", async () => {
      const result = await convertPdfToImages(
        "/app/uploads/test.pdf",
        "/tmp/malicious"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("outside allowed directory");
    });

    it("returns error for missing PDF", async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

      const result = await convertPdfToImages(
        "/app/uploads/missing.pdf",
        "/app/uploads/output"
      );

      expect(result.success).toBe(false);
      expect(result.pageCount).toBe(0);
      expect(result.imagePaths).toHaveLength(0);
      expect(result.error).toContain("not found or invalid");
    });

    it("returns error when pdftoppm is not installed", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      mockExecFile((command) => {
        if (command === "pdfinfo") {
          return { stdout: "Pages: 3\n", stderr: "" };
        }
        // Return error for "which pdftoppm"
        throw new Error("not found");
      });

      const result = await convertPdfToImages(
        "/app/uploads/test.pdf",
        "/app/uploads/output"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("pdftoppm");
    });

    it("creates correct output directory structure", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readdir).mockResolvedValue([] as unknown as fsPromises.Dirent[]);

      mockExecFile((command) => {
        if (command === "pdfinfo") {
          return { stdout: "Pages: 0\n", stderr: "" };
        }
        if (command === "which") {
          return { stdout: "/usr/bin/pdftoppm\n", stderr: "" };
        }
        if (command === "pdftoppm") {
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await convertPdfToImages("/app/uploads/test.pdf", "/app/uploads/editions/123");

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("/app/uploads/editions/123/images/pages"),
        { recursive: true }
      );
    });

    it("uses execFile with array arguments for security", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readdir).mockResolvedValue([] as unknown as fsPromises.Dirent[]);

      let capturedArgs: string[] = [];
      mockExecFile((command, args) => {
        if (command === "pdfinfo") {
          return { stdout: "Pages: 1\n", stderr: "" };
        }
        if (command === "which") {
          return { stdout: "/usr/bin/pdftoppm\n", stderr: "" };
        }
        if (command === "pdftoppm") {
          capturedArgs = args;
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await convertPdfToImages("/app/uploads/test.pdf", "/app/uploads/output", 300);

      // Verify args are passed as array (secure)
      expect(capturedArgs).toContain("-png");
      expect(capturedArgs).toContain("-r");
      expect(capturedArgs).toContain("300");
      expect(capturedArgs).toContain("/app/uploads/test.pdf");
    });

    it("returns elapsed time in result", async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readdir).mockResolvedValue(["page-1.png"] as unknown as fsPromises.Dirent[]);

      mockExecFile((command) => {
        if (command === "pdfinfo") {
          return { stdout: "Pages: 1\n", stderr: "" };
        }
        if (command === "which") {
          return { stdout: "/usr/bin/pdftoppm\n", stderr: "" };
        }
        if (command === "pdftoppm") {
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await convertPdfToImages(
        "/app/uploads/test.pdf",
        "/app/uploads/output"
      );

      expect(result.elapsedMs).toBeDefined();
      expect(typeof result.elapsedMs).toBe("number");
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("cleanupGeneratedImages", () => {
    it("removes the pages directory", async () => {
      vi.mocked(fsPromises.rm).mockResolvedValue(undefined);

      await cleanupGeneratedImages("/app/uploads/editions/1/images/pages");

      expect(fsPromises.rm).toHaveBeenCalledWith(
        "/app/uploads/editions/1/images/pages",
        { recursive: true, force: true }
      );
    });

    it("handles cleanup errors gracefully", async () => {
      vi.mocked(fsPromises.rm).mockRejectedValue(new Error("Permission denied"));

      // Should not throw
      await expect(cleanupGeneratedImages("/app/uploads/editions/1/images/pages")).resolves.toBeUndefined();
    });
  });
});
