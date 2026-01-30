import { readFile, readdir } from "fs/promises";
import { join, basename, extname, resolve, relative } from "path";
import * as cheerio from "cheerio";
import type {
  XhtmlExport,
  LoadedSpread,
  SpreadInfo,
  ImageIndex,
  StyleAnalysis,
  CoverHeadline,
} from "@/types";
import { extractMetadata } from "./metadata-extractor";
import {
  analyzeStyles,
  analyzeHtmlClasses,
  mergeStyleAnalysis,
} from "./structure-analyzer";

/** Supported image file extensions */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

/** Base directory for uploads (validated paths must be within this) */
const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || "./uploads";

/**
 * Validate that a path is within the allowed uploads directory
 * Prevents path traversal attacks
 */
function validatePath(inputPath: string): { valid: boolean; error?: string } {
  const resolvedPath = resolve(inputPath);
  const resolvedBase = resolve(UPLOADS_BASE_DIR);

  // Check if the path is within the uploads directory
  const relativePath = relative(resolvedBase, resolvedPath);

  // If relative path starts with ".." or is absolute, it's outside uploads
  if (relativePath.startsWith("..") || resolve(relativePath) === relativePath) {
    return {
      valid: false,
      error: `Path "${inputPath}" is outside the allowed uploads directory`
    };
  }

  return { valid: true };
}

/**
 * Parse page information from HTML filename
 *
 * Single-page export mapping (1 HTML file = 1 page):
 * - publication.html → page 1 (cover)
 * - publication-N.html → page N+1
 *
 * Examples:
 * - publication.html = page 1 (cover)
 * - publication-1.html = page 2
 * - publication-2.html = page 3
 * - publication-3.html = page 4
 */
export function parseSpreadFromFilename(filename: string): SpreadInfo {
  const baseName = basename(filename, ".html");

  if (baseName === "publication") {
    // Cover page (page 1)
    return {
      filename,
      spreadIndex: 0,
      pageStart: 1,
      pageEnd: 1,
    };
  }

  // publication-N pattern: page N+1
  const match = baseName.match(/^publication-(\d+)$/);
  if (match) {
    const fileIndex = parseInt(match[1]);
    const pageNumber = fileIndex + 1; // publication-1.html = page 2
    return {
      filename,
      spreadIndex: fileIndex,
      pageStart: pageNumber,
      pageEnd: pageNumber,
    };
  }

  throw new Error(`Unknown HTML filename pattern: ${filename}`);
}

/**
 * Find the HTML directory in an XHTML export
 * Handles both direct structure and nested folder structure (e.g., from ZIP extraction)
 */
async function findHtmlDir(xhtmlDir: string): Promise<string | null> {
  // First, try the direct path
  const directPath = join(xhtmlDir, "publication-web-resources", "html");
  try {
    await readdir(directPath);
    return directPath;
  } catch {
    // Not found directly, look for a content subfolder
  }

  // Look for a content subfolder (excluding __MACOSX)
  try {
    const entries = await readdir(xhtmlDir);
    for (const entry of entries) {
      if (entry === "__MACOSX" || entry.startsWith(".")) continue;
      const subPath = join(
        xhtmlDir,
        entry,
        "publication-web-resources",
        "html"
      );
      try {
        await readdir(subPath);
        return subPath;
      } catch {
        // This subfolder doesn't have the expected structure
      }
    }
  } catch {
    // xhtmlDir doesn't exist or isn't readable
  }

  return null;
}

/**
 * Find the resources base directory (parent of html, image, css)
 */
async function findResourcesDir(xhtmlDir: string): Promise<string | null> {
  const htmlDir = await findHtmlDir(xhtmlDir);
  if (htmlDir) {
    // html dir is publication-web-resources/html, so parent is resources dir
    return join(htmlDir, "..");
  }
  return null;
}

/**
 * Load all HTML spreads from the XHTML export
 */
async function loadSpreads(htmlDir: string): Promise<LoadedSpread[]> {
  const files = await readdir(htmlDir);
  const spreads: LoadedSpread[] = [];

  for (const file of files) {
    const fileName = typeof file === "string" ? file : String(file);
    if (!fileName.endsWith(".html")) continue;

    try {
      const spreadInfo = parseSpreadFromFilename(fileName);
      const html = await readFile(join(htmlDir, fileName), "utf-8");

      spreads.push({
        ...spreadInfo,
        html,
      });
    } catch (error) {
      console.warn(`[XHTML Loader] Skipping file ${fileName}:`, error);
    }
  }

  // Sort by spread index for correct order
  spreads.sort((a, b) => a.spreadIndex - b.spreadIndex);
  return spreads;
}

/**
 * Index all images in the XHTML export
 */
async function indexImages(imageDir: string): Promise<ImageIndex> {
  const images = new Map<string, string>();
  const articleImages: string[] = [];
  const authorPhotos: string[] = [];
  const decorativeImages: string[] = [];

  const files = await readdir(imageDir);

  for (const file of files) {
    const fileName = typeof file === "string" ? file : String(file);
    const ext = extname(fileName).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) continue;

    const relativePath = `publication-web-resources/image/${fileName}`;
    images.set(fileName, relativePath);

    // Categorize by filename patterns (heuristic)
    const lowerFile = fileName.toLowerCase();
    if (lowerFile.includes("auteur") || lowerFile.includes("author")) {
      authorPhotos.push(fileName);
    } else if (lowerFile.includes("logo") || lowerFile.includes("icon")) {
      decorativeImages.push(fileName);
    } else {
      articleImages.push(fileName);
    }
  }

  return { images, articleImages, authorPhotos, decorativeImages };
}

/**
 * Create an empty ImageIndex for error cases
 */
function emptyImageIndex(): ImageIndex {
  return {
    images: new Map(),
    articleImages: [],
    authorPhotos: [],
    decorativeImages: [],
  };
}

/**
 * Create an empty StyleAnalysis for error cases
 */
function emptyStyleAnalysis(): StyleAnalysis {
  return {
    classMap: new Map<string, string>(),
    articleBoundaryClasses: [],
    titleClasses: [],
    chapeauClasses: [],
    bodyClasses: [],
    authorClasses: [],
    categoryClasses: [],
    subheadingClasses: [],
    streamerClasses: [],
    sidebarClasses: [],
    captionClasses: [],
    coverTitleClasses: [],
    coverChapeauClasses: [],
    introVerseClasses: [],
    authorBioClasses: [],
    verseReferenceClasses: [],
    questionClasses: [],
  };
}

/**
 * Extract cover metadata from the cover spread (page 1)
 *
 * Cover content in InDesign exports uses Omslag_* classes and does not have
 * the ■ article end marker. This function extracts cover headlines as
 * edition-level metadata.
 *
 * @param coverSpread - The first spread (page 1, cover)
 * @param styles - StyleAnalysis with coverTitleClasses and coverChapeauClasses
 * @returns Array of CoverHeadline objects
 */
export function extractCoverMetadata(
  coverSpread: LoadedSpread,
  styles: StyleAnalysis
): CoverHeadline[] {
  const headlines: CoverHeadline[] = [];
  const $ = cheerio.load(coverSpread.html);

  // Build selectors for cover elements
  const titleSelector = styles.coverTitleClasses.map((c) => `.${c}`).join(", ");
  const chapeauSelector = styles.coverChapeauClasses.map((c) => `.${c}`).join(", ");

  if (!titleSelector) {
    console.log("[XHTML Loader] No cover title classes found, skipping cover extraction");
    return headlines;
  }

  // Extract cover titles
  $(titleSelector).each((_, el) => {
    const title = $(el).text().trim();
    if (!title) return;

    const headline: CoverHeadline = { title };

    // Look for associated chapeau/ankeiler nearby (next sibling or within same parent)
    if (chapeauSelector) {
      const $parent = $(el).parent();
      const $sibling = $(el).next();

      // Check next sibling first
      if ($sibling.is(chapeauSelector)) {
        headline.subtitle = $sibling.text().trim();
      } else {
        // Check for chapeau within same parent
        const $chapeau = $parent.find(chapeauSelector).first();
        if ($chapeau.length > 0) {
          headline.subtitle = $chapeau.text().trim();
        }
      }
    }

    headlines.push(headline);
  });

  console.log(`[XHTML Loader] Extracted ${headlines.length} cover headlines`);
  return headlines;
}

/**
 * Load and parse a complete XHTML export
 *
 * @param xhtmlDir - Root directory of the XHTML export
 * @returns XhtmlExport with all parsed content, or partial content with errors
 */
export async function loadXhtmlExport(xhtmlDir: string): Promise<XhtmlExport> {
  const errors: string[] = [];

  // Security: validate path is within uploads directory
  const pathValidation = validatePath(xhtmlDir);
  if (!pathValidation.valid) {
    console.error(`[XHTML Loader] ${pathValidation.error}`);
    errors.push(pathValidation.error!);
    // Return empty result with error for security violations
    return {
      rootDir: xhtmlDir,
      spreads: [],
      images: emptyImageIndex(),
      styles: emptyStyleAnalysis(),
      metadata: { editionNumber: null, editionDate: null },
      errors,
    };
  }

  console.log(`[XHTML Loader] Loading export from: ${xhtmlDir}`);

  // Find resources directory
  const resourcesDir = await findResourcesDir(xhtmlDir);

  // 1. Load spreads
  let spreads: LoadedSpread[] = [];
  if (resourcesDir) {
    const htmlDir = join(resourcesDir, "html");
    try {
      spreads = await loadSpreads(htmlDir);
      console.log(`[XHTML Loader] Loaded ${spreads.length} spreads`);
    } catch (error) {
      const msg = `Failed to load spreads: ${error}`;
      errors.push(msg);
      console.error(`[XHTML Loader] ${msg}`);
    }
  } else {
    errors.push("Could not find HTML directory in XHTML export");
    console.warn("[XHTML Loader] Could not find HTML directory");
  }

  // 2. Index images
  let images: ImageIndex = emptyImageIndex();
  if (resourcesDir) {
    const imageDir = join(resourcesDir, "image");
    try {
      images = await indexImages(imageDir);
      console.log(`[XHTML Loader] Indexed ${images.images.size} images`);
    } catch (error) {
      const msg = `Failed to index images: ${error}`;
      errors.push(msg);
      console.error(`[XHTML Loader] ${msg}`);
    }
  }

  // 3. Analyze CSS styles and HTML classes
  let styles: StyleAnalysis = emptyStyleAnalysis();
  if (resourcesDir) {
    const cssDir = join(resourcesDir, "css");
    const htmlDir = join(resourcesDir, "html");

    // Analyze CSS for class definitions
    try {
      const cssStyles = await analyzeStyles(cssDir);
      styles = cssStyles;
      console.log(
        `[XHTML Loader] Analyzed CSS, found ${styles.classMap.size} class mappings`
      );
    } catch (error) {
      const msg = `Failed to analyze CSS styles: ${error}`;
      errors.push(msg);
      console.error(`[XHTML Loader] ${msg}`);
    }

    // Also analyze HTML for class names (InDesign often puts semantic names in HTML only)
    try {
      const htmlStyles = await analyzeHtmlClasses(htmlDir);
      styles = mergeStyleAnalysis(styles, htmlStyles);
      console.log(
        `[XHTML Loader] Merged HTML classes, total ${styles.classMap.size} class mappings`
      );
    } catch (error) {
      const msg = `Failed to analyze HTML classes: ${error}`;
      errors.push(msg);
      console.error(`[XHTML Loader] ${msg}`);
    }
  }

  // 4. Extract metadata (reuse existing extractor)
  let metadata = { editionNumber: null as number | null, editionDate: null as Date | null };
  try {
    metadata = await extractMetadata(xhtmlDir);
    console.log(
      `[XHTML Loader] Metadata: edition ${metadata.editionNumber}, date ${metadata.editionDate}`
    );
  } catch (error) {
    const msg = `Failed to extract metadata: ${error}`;
    errors.push(msg);
    console.error(`[XHTML Loader] ${msg}`);
  }

  if (errors.length > 0) {
    console.warn(
      `[XHTML Loader] Completed with ${errors.length} error(s)`
    );
  }

  return {
    rootDir: xhtmlDir,
    spreads,
    images,
    styles,
    metadata,
    errors,
  };
}
