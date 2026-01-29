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
  /** Classes that indicate subheadings/tussenkoppen */
  subheadingClasses: string[];
  /** Classes that indicate streamers/quotes */
  streamerClasses: string[];
  /** Classes that indicate sidebars/kaders */
  sidebarClasses: string[];
  /** Classes that indicate captions/bijschriften */
  captionClasses: string[];
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
  /** Subheadings/tussenkoppen extracted (plain text) */
  subheadings: string[];
  /** Streamers/quotes extracted (plain text) */
  streamers: string[];
  /** Sidebar/kader content blocks (cleaned HTML) */
  sidebars: string[];
  /** Image captions extracted (plain text), indexed by image filename */
  captions: Map<string, string>;
}

/**
 * Intermediate element during parsing
 */
export interface ArticleElement {
  type: "title" | "chapeau" | "body" | "author" | "category" | "image" | "subheading" | "streamer" | "sidebar" | "caption" | "unknown";
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

/**
 * Rich content block types for structured content extraction
 */
export type ContentBlockType = "paragraph" | "subheading" | "image" | "quote" | "sidebar";

/**
 * A content block with typed content
 */
export interface ContentBlock {
  type: ContentBlockType;
  content: string;
  /** For image blocks: the image URL */
  imageUrl?: string;
  /** For image blocks: the caption */
  caption?: string;
  /** Sort order within the article */
  order: number;
}

/**
 * Extracted image with metadata
 */
export interface ExtractedImage {
  /** Source filename in XHTML export */
  filename: string;
  /** Relative path from XHTML root */
  sourcePath: string;
  /** Caption if found */
  caption: string | null;
  /** Whether this is the featured/main image */
  isFeatured: boolean;
  /** Sort order (0 = first/featured) */
  sortOrder: number;
  /** Article title this image belongs to (for mapping) */
  articleTitle: string;
}

/**
 * Result of image mapping
 */
export interface ImageMappingResult {
  images: ExtractedImage[];
  errors: string[];
}

/**
 * Rich content extraction result
 */
export interface RichContentResult {
  /** Subheadings extracted from article */
  subheadings: string[];
  /** Streamers/quotes extracted */
  streamers: string[];
  /** Sidebar/kader blocks extracted */
  sidebars: ContentBlock[];
  /** Structured content blocks in order */
  contentBlocks: ContentBlock[];
  errors: string[];
}
