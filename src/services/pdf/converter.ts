import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, readdir, access, rm } from "fs/promises";
import { join, resolve } from "path";

const execFileAsync = promisify(execFile);

/**
 * Get the uploads root directory
 * Uses UPLOADS_ROOT env var or defaults to ./uploads
 */
export function getUploadsRoot(): string {
  return process.env.UPLOADS_ROOT || join(process.cwd(), "uploads");
}

/**
 * Validate that a path is within the uploads directory (prevent path traversal)
 * @param targetPath - The path to validate
 * @returns true if path is within uploads directory
 */
export function isPathWithinUploads(targetPath: string): boolean {
  const uploadsRoot = getUploadsRoot();
  const resolvedTarget = resolve(targetPath);
  const resolvedUploads = resolve(uploadsRoot);

  // Check that resolved target path starts with the resolved uploads root
  // This handles path traversal attempts like "../../../etc/passwd"
  return resolvedTarget.startsWith(resolvedUploads + "/") || resolvedTarget === resolvedUploads;
}

export interface ConversionResult {
  success: boolean;
  pageCount: number;
  imagePaths: string[];
  elapsedMs?: number;
  error?: string;
}

/**
 * Check if Poppler's pdftoppm is installed and available
 */
export async function checkPopplerInstalled(): Promise<boolean> {
  try {
    await execFileAsync("which", ["pdftoppm"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the number of pages in a PDF using pdfinfo
 */
export async function getPdfPageCount(pdfPath: string): Promise<number> {
  try {
    // Validate path is within uploads directory
    if (!isPathWithinUploads(pdfPath)) {
      console.error("[PDF Converter] Path validation failed for getPdfPageCount");
      return 0;
    }

    const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
    const match = stdout.match(/Pages:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Validate that a PDF file exists, is readable, and is within uploads directory
 */
export async function validatePdf(pdfPath: string): Promise<boolean> {
  try {
    // Validate path is within uploads directory (prevent path traversal)
    if (!isPathWithinUploads(pdfPath)) {
      console.error("[PDF Converter] Path validation failed: path outside uploads directory");
      return false;
    }

    await access(pdfPath);
    // Use pdfinfo to validate PDF structure (using execFile for security)
    await execFileAsync("pdfinfo", [pdfPath]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert PDF to PNG images using Poppler's pdftoppm
 *
 * @param pdfPath - Path to the input PDF file
 * @param outputDir - Base directory for the edition (images will be in outputDir/images/pages/)
 * @param resolution - DPI resolution (default 150 for screen viewing)
 * @returns ConversionResult with success status and list of generated image paths
 */
export async function convertPdfToImages(
  pdfPath: string,
  outputDir: string,
  resolution: number = 150
): Promise<ConversionResult> {
  const startTime = Date.now();

  // Validate PDF path is within uploads directory (security: prevent path traversal)
  if (!isPathWithinUploads(pdfPath)) {
    return {
      success: false,
      pageCount: 0,
      imagePaths: [],
      error: "PDF path is outside allowed directory",
    };
  }

  // Validate output directory is within uploads
  if (!isPathWithinUploads(outputDir)) {
    return {
      success: false,
      pageCount: 0,
      imagePaths: [],
      error: "Output directory is outside allowed directory",
    };
  }

  // Validate PDF exists and is valid
  const isValid = await validatePdf(pdfPath);
  if (!isValid) {
    return {
      success: false,
      pageCount: 0,
      imagePaths: [],
      error: `PDF file not found or invalid: ${pdfPath}`,
    };
  }

  // Check Poppler is installed
  const hasPdftoppm = await checkPopplerInstalled();
  if (!hasPdftoppm) {
    return {
      success: false,
      pageCount: 0,
      imagePaths: [],
      error: "pdftoppm (Poppler) is not installed",
    };
  }

  // Create output directory structure
  const pagesDir = join(outputDir, "images", "pages");
  await mkdir(pagesDir, { recursive: true });

  const outputPrefix = join(pagesDir, "page");

  try {
    // Run pdftoppm to convert PDF to PNG images
    // Using execFile with array arguments for security (no shell injection)
    const args = ["-png", "-r", String(resolution), pdfPath, outputPrefix];

    console.log(`[PDF Converter] Running: pdftoppm ${args.join(" ")}`);
    await execFileAsync("pdftoppm", args);

    const elapsedMs = Date.now() - startTime;
    console.log(`[PDF Converter] Conversion completed in ${elapsedMs}ms`);

    // Get list of generated files
    const files = await readdir(pagesDir);
    const pngFiles = files
      .filter((f) => f.endsWith(".png"))
      .sort(); // Ensure correct order (page-01.png, page-02.png, etc.)

    const imagePaths = pngFiles.map((f) => join(pagesDir, f));

    return {
      success: true,
      pageCount: pngFiles.length,
      imagePaths,
      elapsedMs,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error("[PDF Converter] Conversion error occurred");

    return {
      success: false,
      pageCount: 0,
      imagePaths: [],
      elapsedMs,
      error: error instanceof Error ? error.message : "Unknown conversion error",
    };
  }
}

/**
 * Clean up generated image files (used for rollback on transaction failure)
 */
export async function cleanupGeneratedImages(pagesDir: string): Promise<void> {
  try {
    await rm(pagesDir, { recursive: true, force: true });
    console.log(`[PDF Converter] Cleaned up directory: ${pagesDir}`);
  } catch {
    console.error("[PDF Converter] Failed to cleanup images directory");
  }
}
