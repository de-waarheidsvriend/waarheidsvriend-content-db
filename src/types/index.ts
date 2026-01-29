/**
 * Shared TypeScript types for the application
 */

/**
 * Metadata extracted from XHTML edition export
 */
export interface EditionMetadata {
  editionNumber: number | null;
  editionDate: Date | null;
}

/**
 * Upload step states for progress tracking
 */
export type UploadStep = "uploading" | "processing" | "parsing" | "completed";
