import { convertPdfToImages, cleanupGeneratedImages, getUploadsRoot } from "./converter";
import { prisma } from "@/lib/db";
import { join, relative } from "path";

export interface ProcessPdfResult {
  success: boolean;
  pageCount: number;
  pageImages: Array<{ pageNumber: number; imageUrl: string }>;
  elapsedMs?: number;
  error?: string;
}

/**
 * Process a PDF file: convert to images and create database records
 *
 * @param editionId - The edition ID to associate the page images with
 * @param pdfPath - Absolute path to the PDF file
 * @param editionDir - Base directory for the edition (e.g., uploads/editions/123)
 * @returns ProcessPdfResult with success status and created page images
 */
export async function processPdf(
  editionId: number,
  pdfPath: string,
  editionDir: string
): Promise<ProcessPdfResult> {
  console.log(`[PDF Service] Processing PDF for edition ${editionId}`);

  // Convert PDF to images
  const result = await convertPdfToImages(pdfPath, editionDir);

  if (!result.success) {
    console.error(`[PDF Service] Conversion failed: ${result.error}`);
    return {
      success: false,
      pageCount: 0,
      pageImages: [],
      elapsedMs: result.elapsedMs,
      error: result.error,
    };
  }

  // Prepare database records
  const uploadsRoot = getUploadsRoot();
  const pagesDir = join(editionDir, "images", "pages");

  // Build data for bulk insert
  const insertData = result.imagePaths.map((absolutePath, index) => ({
    edition_id: editionId,
    page_number: index + 1, // 1-indexed
    image_url: relative(uploadsRoot, absolutePath),
  }));

  try {
    // Use createMany for efficient bulk insert within transaction
    await prisma.$transaction(async (tx) => {
      await tx.pageImage.createMany({
        data: insertData,
      });
    });

    // Build response from insert data
    const pageImages = insertData.map((data) => ({
      pageNumber: data.page_number,
      imageUrl: data.image_url,
    }));

    console.log(
      `[PDF Service] Created ${pageImages.length} page images for edition ${editionId}`
    );

    return {
      success: true,
      pageCount: pageImages.length,
      pageImages,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    // Transaction failed - cleanup orphaned image files
    console.error("[PDF Service] Database transaction failed, cleaning up images");
    await cleanupGeneratedImages(pagesDir);

    return {
      success: false,
      pageCount: 0,
      pageImages: [],
      elapsedMs: result.elapsedMs,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}

/**
 * Get page images for an article based on its page range
 *
 * @param editionId - The edition ID
 * @param pageStart - Starting page number (1-indexed, inclusive)
 * @param pageEnd - Ending page number (1-indexed, inclusive)
 * @returns Array of PageImage records for the given page range
 * @throws Error if parameters are invalid
 */
export async function getPageImagesForArticle(
  editionId: number,
  pageStart: number,
  pageEnd: number
) {
  // Input validation
  if (!Number.isInteger(editionId) || editionId < 1) {
    throw new Error("editionId must be a positive integer");
  }
  if (!Number.isInteger(pageStart) || pageStart < 1) {
    throw new Error("pageStart must be a positive integer");
  }
  if (!Number.isInteger(pageEnd) || pageEnd < 1) {
    throw new Error("pageEnd must be a positive integer");
  }
  if (pageStart > pageEnd) {
    throw new Error("pageStart must be less than or equal to pageEnd");
  }

  return prisma.pageImage.findMany({
    where: {
      edition_id: editionId,
      page_number: {
        gte: pageStart,
        lte: pageEnd,
      },
    },
    orderBy: { page_number: "asc" },
  });
}

/**
 * Get all page images for an edition
 *
 * @param editionId - The edition ID
 * @returns Array of all PageImage records for the edition
 * @throws Error if editionId is invalid
 */
export async function getPageImagesForEdition(editionId: number) {
  // Input validation
  if (!Number.isInteger(editionId) || editionId < 1) {
    throw new Error("editionId must be a positive integer");
  }

  return prisma.pageImage.findMany({
    where: { edition_id: editionId },
    orderBy: { page_number: "asc" },
  });
}

// Re-export converter functions for direct access
export {
  convertPdfToImages,
  cleanupGeneratedImages,
  checkPopplerInstalled,
  getPdfPageCount,
  validatePdf,
  getUploadsRoot,
  isPathWithinUploads,
} from "./converter";
