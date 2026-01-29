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

/**
 * Spread information extracted from HTML filename
 */
export interface SpreadInfo {
  filename: string;
  spreadIndex: number;
  pageStart: number;
  pageEnd: number;
}

/**
 * Loaded spread with HTML content
 * Note: Cheerio parsing is done on-demand by consumers to avoid
 * serialization issues and memory overhead for large exports
 */
export interface LoadedSpread extends SpreadInfo {
  /** Raw HTML content */
  html: string;
}

/**
 * Index of images in the XHTML export
 */
export interface ImageIndex {
  /** filename (without path) → relative path from xhtml root */
  images: Map<string, string>;
  /** Images likely belonging to articles */
  articleImages: string[];
  /** Author photo images */
  authorPhotos: string[];
  /** Decorative/logo images */
  decorativeImages: string[];
}

/**
 * CSS style analysis from InDesign export
 */
export interface StyleAnalysis {
  /** CSS class name → semantic meaning */
  classMap: Map<string, string>;
  /** Classes that indicate article boundaries */
  articleBoundaryClasses: string[];
  /** Classes that indicate title elements */
  titleClasses: string[];
  /** Classes that indicate chapeau/intro text */
  chapeauClasses: string[];
  /** Classes that indicate body text */
  bodyClasses: string[];
  /** Classes that indicate author references */
  authorClasses: string[];
  /** Classes that indicate category/rubric */
  categoryClasses: string[];
}

/**
 * Complete XHTML export structure
 */
export interface XhtmlExport {
  /** Base directory of the export */
  rootDir: string;
  /** Loaded spreads in order */
  spreads: LoadedSpread[];
  /** Image index */
  images: ImageIndex;
  /** CSS analysis */
  styles: StyleAnalysis;
  /** Metadata (from existing extractor) */
  metadata: EditionMetadata;
  /** Errors encountered during loading (for graceful degradation) */
  errors: string[];
}

/**
 * Extracted article before database save
 */
export interface ExtractedArticle {
  /** Article title (cleaned text) */
  title: string;
  /** Chapeau/intro text (cleaned, optional) */
  chapeau: string | null;
  /** Body content as cleaned HTML */
  content: string;
  /** Excerpt (first ~150 chars of body, plain text) */
  excerpt: string | null;
  /** Category/rubriek if detected */
  category: string | null;
  /** First page where article appears */
  pageStart: number;
  /** Last page where article appears */
  pageEnd: number;
  /** Source spreads (for debugging) */
  sourceSpreadIndexes: number[];
  /** Images referenced in this article (filenames) */
  referencedImages: string[];
}

/**
 * Intermediate element during parsing
 */
export interface ArticleElement {
  type: "title" | "chapeau" | "body" | "author" | "category" | "image" | "unknown";
  content: string;
  className: string;
  spreadIndex: number;
  pageStart: number;
  pageEnd: number;
}

/**
 * Result of article extraction with errors for graceful degradation
 */
export interface ArticleExtractionResult {
  articles: ExtractedArticle[];
  errors: string[];
}

/**
 * Extracted author before database save
 */
export interface ExtractedAuthor {
  /** Author name (normalized) */
  name: string;
  /** Photo filename if found */
  photoFilename: string | null;
  /** Photo source path (relative to xhtml export root) */
  photoSourcePath: string | null;
  /** Article titles this author is linked to (for mapping to saved articles) */
  articleTitles: string[];
}

/**
 * Result of author extraction with errors for graceful degradation
 */
export interface AuthorExtractionResult {
  authors: ExtractedAuthor[];
  errors: string[];
}
