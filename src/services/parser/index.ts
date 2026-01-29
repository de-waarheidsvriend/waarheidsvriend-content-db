/**
 * Processing Orchestration Service
 *
 * This module orchestrates the complete content extraction pipeline:
 * 1. PDF naar images conversie (Story 2.2)
 * 2. XHTML laden en structuur analyseren (Story 2.3)
 * 3. Artikelen extraheren (Story 2.4)
 * 4. Auteurs en categorieën extraheren (Story 2.5)
 * 5. Afbeeldingen en rich content koppelen (Story 2.6)
 *
 * Implements:
 * - FR3: Automatische verwerking na upload
 * - NFR1: Verwerking < 2 minuten voor 12 spreads, ~15 artikelen
 * - NFR10: Per-artikel error isolation (graceful degradation)
 * - NFR11: Gestructureerde error logging
 */

import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

import { loadXhtmlExport } from "./xhtml-loader";
import { extractArticles, saveArticles } from "./article-extractor";
import { extractAuthorsFromArticles, saveAuthors } from "./author-extractor";
import { mapImagesToArticles, saveImages } from "./rich-content-extractor";
import { processPdf } from "@/services/pdf";

/**
 * Structured log entry for parser operations
 */
export interface ParserLogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error";
  module: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Processing pipeline result
 */
export interface ProcessingResult {
  success: boolean;
  editionId: number;
  status: "completed" | "completed_with_errors" | "failed";
  stats: {
    articlesExtracted: number;
    articlesSaved: number;
    authorsExtracted: number;
    authorsSaved: number;
    imagesExtracted: number;
    imagesSaved: number;
    pdfPagesConverted: number;
    elapsedMs: number;
  };
  errors: ParserLogEntry[];
  warnings: ParserLogEntry[];
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: ParserLogEntry["level"],
  module: string,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): ParserLogEntry {
  const entry: ParserLogEntry = {
    timestamp: new Date(),
    level,
    module,
    message,
    context,
  };

  if (error) {
    entry.error = {
      message: error.message,
      stack: error.stack,
    };
  }

  // Also log to console with structured format
  const prefix = `[${module}]`;
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";

  if (level === "error") {
    console.error(`${prefix} ${message}${contextStr}`, error || "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}${contextStr}`);
  } else {
    console.log(`${prefix} ${message}${contextStr}`);
  }

  return entry;
}

/**
 * Process a complete edition upload
 *
 * This is the main orchestration function that coordinates all parsing steps.
 * It implements graceful degradation - individual article failures don't stop
 * the entire pipeline.
 *
 * @param editionId - The ID of the edition to process
 * @param editionDir - Base directory containing xhtml/ and pdf/ subdirectories
 * @param uploadsDir - Base uploads directory (for resolving output paths)
 * @returns ProcessingResult with status and statistics
 */
export async function processEdition(
  editionId: number,
  editionDir: string,
  uploadsDir: string
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const errors: ParserLogEntry[] = [];
  const warnings: ParserLogEntry[] = [];

  const stats = {
    articlesExtracted: 0,
    articlesSaved: 0,
    authorsExtracted: 0,
    authorsSaved: 0,
    imagesExtracted: 0,
    imagesSaved: 0,
    pdfPagesConverted: 0,
    elapsedMs: 0,
  };

  const log = (
    level: ParserLogEntry["level"],
    module: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ) => {
    const entry = createLogEntry(level, module, message, context, error);
    if (level === "error") {
      errors.push(entry);
    } else if (level === "warn") {
      warnings.push(entry);
    }
    return entry;
  };

  log("info", "Orchestrator", "Starting edition processing", { editionId, editionDir });

  const xhtmlDir = join(editionDir, "xhtml");
  const pdfPath = join(editionDir, "pdf", "editie.pdf");

  try {
    // =========================================================================
    // Step 1: PDF naar images conversie (parallel with XHTML loading)
    // =========================================================================
    log("info", "Orchestrator", "Step 1: Starting PDF conversion", { editionId });

    const pdfResultPromise = processPdf(editionId, pdfPath, editionDir);

    // =========================================================================
    // Step 2: XHTML laden en structuur analyseren
    // =========================================================================
    log("info", "Orchestrator", "Step 2: Loading XHTML export", { xhtmlDir });

    const xhtmlExport = await loadXhtmlExport(xhtmlDir);

    // Log any XHTML loading errors as warnings (non-fatal)
    for (const xhtmlError of xhtmlExport.errors) {
      log("warn", "XhtmlLoader", xhtmlError, { editionId });
    }

    if (xhtmlExport.spreads.length === 0) {
      log("error", "XhtmlLoader", "No spreads found in XHTML export", { editionId, xhtmlDir });
      throw new Error("No spreads found in XHTML export - cannot proceed");
    }

    log("info", "Orchestrator", "XHTML loaded successfully", {
      editionId,
      spreadsCount: xhtmlExport.spreads.length,
      imagesCount: xhtmlExport.images.images.size,
    });

    // Wait for PDF conversion to complete
    const pdfResult = await pdfResultPromise;

    if (pdfResult.success) {
      stats.pdfPagesConverted = pdfResult.pageCount;
      log("info", "PdfConverter", "PDF conversion completed", {
        editionId,
        pageCount: pdfResult.pageCount,
        elapsedMs: pdfResult.elapsedMs,
      });
    } else {
      log("warn", "PdfConverter", "PDF conversion failed", {
        editionId,
        error: pdfResult.error,
      });
      // PDF conversion failure is non-fatal - we can still extract content
    }

    // =========================================================================
    // Step 3: Artikelen extraheren
    // =========================================================================
    log("info", "Orchestrator", "Step 3: Extracting articles", { editionId });

    const articleResult = await extractArticles(xhtmlExport);
    stats.articlesExtracted = articleResult.articles.length;

    // Log article extraction errors
    for (const articleError of articleResult.errors) {
      log("warn", "ArticleExtractor", articleError, { editionId });
    }

    if (articleResult.articles.length === 0) {
      log("error", "ArticleExtractor", "No articles extracted", { editionId });
      // This is serious but we continue to update the edition status
    } else {
      log("info", "ArticleExtractor", "Articles extracted", {
        editionId,
        count: articleResult.articles.length,
      });
    }

    // Save articles to database
    const saveArticleResult = await saveArticles(
      prisma as PrismaClient,
      editionId,
      articleResult.articles
    );
    stats.articlesSaved = saveArticleResult.articles.length;

    for (const saveError of saveArticleResult.errors) {
      log("error", "ArticleExtractor", saveError, { editionId });
    }

    // Build article title -> ID map for relationship creation
    const articleMap = new Map<string, number>();
    for (const article of saveArticleResult.articles) {
      articleMap.set(article.title, article.id);
    }

    // =========================================================================
    // Step 4: Auteurs en categorieën extraheren
    // =========================================================================
    log("info", "Orchestrator", "Step 4: Extracting authors", { editionId });

    const authorResult = extractAuthorsFromArticles(articleResult.articles, xhtmlExport);
    stats.authorsExtracted = authorResult.authors.length;

    for (const authorError of authorResult.errors) {
      log("warn", "AuthorExtractor", authorError, { editionId });
    }

    log("info", "AuthorExtractor", "Authors extracted", {
      editionId,
      count: authorResult.authors.length,
    });

    // Save authors to database
    const saveAuthorResult = await saveAuthors(
      prisma as PrismaClient,
      editionId,
      authorResult.authors,
      articleMap,
      xhtmlDir,
      uploadsDir
    );
    stats.authorsSaved = saveAuthorResult.authors.length;

    for (const authorSaveError of saveAuthorResult.errors) {
      log("warn", "AuthorExtractor", authorSaveError, { editionId });
    }

    // =========================================================================
    // Step 5: Afbeeldingen en rich content koppelen
    // =========================================================================
    log("info", "Orchestrator", "Step 5: Mapping images to articles", { editionId });

    const imageResult = mapImagesToArticles(articleResult.articles, xhtmlExport);
    stats.imagesExtracted = imageResult.images.length;

    for (const imageError of imageResult.errors) {
      log("warn", "ImageMapper", imageError, { editionId });
    }

    log("info", "ImageMapper", "Images mapped", {
      editionId,
      count: imageResult.images.length,
    });

    // Save images to database
    const saveImageResult = await saveImages(
      prisma as PrismaClient,
      editionId,
      imageResult.images,
      articleMap,
      xhtmlDir,
      uploadsDir
    );
    stats.imagesSaved = saveImageResult.images.length;

    for (const imageSaveError of saveImageResult.errors) {
      log("warn", "ImageMapper", imageSaveError, { editionId });
    }

    // =========================================================================
    // Determine final status and update edition
    // =========================================================================
    const elapsedMs = Date.now() - startTime;
    stats.elapsedMs = elapsedMs;

    // Determine status based on errors
    let status: ProcessingResult["status"];
    if (errors.length > 0) {
      status = "failed";
    } else if (warnings.length > 0) {
      status = "completed_with_errors";
    } else {
      status = "completed";
    }

    // Special case: if we got some articles, it's not a complete failure
    if (status === "failed" && stats.articlesSaved > 0) {
      status = "completed_with_errors";
    }

    // Update edition status in database
    await updateEditionStatus(editionId, status);

    log("info", "Orchestrator", "Processing completed", {
      editionId,
      status,
      elapsedMs,
      stats,
    });

    return {
      success: status !== "failed",
      editionId,
      status,
      stats,
      errors,
      warnings,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    stats.elapsedMs = elapsedMs;

    log(
      "error",
      "Orchestrator",
      "Fatal error during processing",
      { editionId },
      error instanceof Error ? error : new Error(String(error))
    );

    // Update edition status to failed
    try {
      await updateEditionStatus(editionId, "failed");
    } catch (updateError) {
      log(
        "error",
        "Orchestrator",
        "Failed to update edition status",
        { editionId },
        updateError instanceof Error ? updateError : new Error(String(updateError))
      );
    }

    return {
      success: false,
      editionId,
      status: "failed",
      stats,
      errors,
      warnings,
    };
  }
}

/**
 * Update the edition status in the database
 */
async function updateEditionStatus(
  editionId: number,
  status: ProcessingResult["status"]
): Promise<void> {
  await prisma.edition.update({
    where: { id: editionId },
    data: { status },
  });
}

/**
 * Get the processing status for an edition
 */
export async function getEditionProcessingStatus(
  editionId: number
): Promise<{ status: string; articleCount: number; imageCount: number } | null> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      _count: {
        select: {
          articles: true,
          page_images: true,
        },
      },
    },
  });

  if (!edition) {
    return null;
  }

  return {
    status: edition.status,
    articleCount: edition._count.articles,
    imageCount: edition._count.page_images,
  };
}

// Re-export for convenience
export { loadXhtmlExport } from "./xhtml-loader";
export { extractArticles, saveArticles } from "./article-extractor";
export { extractAuthorsFromArticles, saveAuthors } from "./author-extractor";
export {
  mapImagesToArticles,
  saveImages,
  extractRichContent,
} from "./rich-content-extractor";
