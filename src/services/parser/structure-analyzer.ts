import { readFile, readdir } from "fs/promises";
import { join } from "path";
import type { StyleAnalysis } from "@/types";

/**
 * Extract category from class prefix (e.g., "Meditatie_kop-boven-vers" -> "Meditatie")
 *
 * InDesign exports often use a pattern where the article type/category is used
 * as a prefix in semantic class names. This function extracts that prefix.
 */
export function extractCategoryFromClass(className: string): string | null {
  // Look for pattern: Category_element-name (starts with capital letter)
  const match = className.match(/^([A-Z][a-zA-Z]+)_/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Classify a class name into a semantic category based on Dutch/English naming patterns
 */
export function classifyClassName(className: string): string | null {
  const lowerName = className.toLowerCase();

  // Skip generic InDesign override classes
  if (
    lowerName.startsWith("charoverride") ||
    lowerName.startsWith("paraoverride") ||
    lowerName.startsWith("objectstyle") ||
    lowerName.startsWith("_idgen")
  ) {
    return null;
  }

  // Heuristic classification based on common Dutch/English terms
  // Order matters - more specific matches should come first

  // ========== COVER PATTERNS (check FIRST - before general kop/chapeau) ==========
  if (lowerName.includes("omslag_kop") || lowerName.includes("cover_title")) {
    return "cover-title";
  }
  if (
    lowerName.includes("omslag_ankeiler") ||
    lowerName.includes("omslag_chapeau") ||
    lowerName.includes("cover_chapeau")
  ) {
    return "cover-chapeau";
  }

  // ========== MEDITATIE PATTERNS (check before title) ==========
  if (
    lowerName.includes("meditatie_kop-boven-vers") ||
    lowerName.includes("kop-boven-vers")
  ) {
    return "intro-verse";
  }
  // Verse reference (e.g., "Psalm 57:2b")
  if (lowerName.includes("meditatie_vers") && !lowerName.includes("boven-vers")) {
    return "verse-reference";
  }

  // ========== AUTHOR BIO PATTERN (check before caption) ==========
  // Note: 'Artikelen_Onderschrift-auteur' = bio (paragraph)
  // 'Onderschrift-auteur_naam-auteur' = name (span) -> handled below as author
  if (
    lowerName === "artikelen_onderschrift-auteur" ||
    (lowerName.includes("onderschrift-auteur") &&
      !lowerName.includes("naam") &&
      !lowerName.includes("info-auteur"))
  ) {
    return "author-bio";
  }

  // ========== AUTHOR NAME PATTERN (span class within info-auteur) ==========
  if (lowerName.includes("onderschrift-auteur_naam-auteur")) {
    return "author";
  }

  // Interview question patterns (must check before general subheading patterns)
  if (lowerName.includes("tussenkop-vraag") || lowerName.includes("question")) {
    return "question";
  }

  // Subheading patterns (must check before general "kop" patterns)
  if (
    lowerName.includes("tussenkop") ||
    lowerName.includes("subheading") ||
    lowerName.includes("subhead")
  ) {
    return "subheading";
  }

  // Streamer/quote patterns (must check before general patterns)
  if (
    lowerName.includes("streamer") ||
    lowerName.includes("quote") ||
    lowerName.includes("citaat") ||
    lowerName.includes("pullquote")
  ) {
    return "streamer";
  }

  // Caption/bijschrift patterns (excluding author-related onderschrift)
  if (
    lowerName.includes("fotobijschrift") ||
    lowerName.includes("bijschrift") ||
    lowerName.includes("caption") ||
    (lowerName.includes("onderschrift") && !lowerName.includes("auteur"))
  ) {
    return "caption";
  }

  // Sidebar/kader patterns (check before body since kadertekst contains "tekst")
  // Exclude "basistekst" - these are body text classes despite containing "kader"
  if (
    (lowerName.includes("kader") && !lowerName.includes("basistekst")) ||
    lowerName.includes("sidebar") ||
    lowerName.includes("inzet") ||
    lowerName.includes("box")
  ) {
    return "sidebar";
  }

  // Book info patterns: book titles in review boxes are sidebars, not article titles
  if (lowerName.includes("titel-boek") || lowerName.includes("title-book")) {
    return "sidebar";
  }

  // Title patterns: kop, hoofdkop, titel, title (excluding cover and verse patterns)
  if (
    lowerName.includes("hoofdkop") ||
    lowerName.includes("titel") ||
    lowerName.includes("title") ||
    (lowerName.includes("kop") &&
      !lowerName.includes("tussenkop") &&
      !lowerName.includes("streamer") &&
      !lowerName.includes("omslag") &&
      !lowerName.includes("boven-vers"))
  ) {
    return "title";
  }

  // Chapeau/intro patterns (excluding cover and verse patterns)
  // Exclude "introletter" and "intro-letter" - that's a drop cap style, not intro text
  if (
    (lowerName.includes("chapeau") && !lowerName.includes("omslag")) ||
    (lowerName.includes("intro") && !lowerName.includes("boven-vers") && !lowerName.includes("introletter") && !lowerName.includes("intro-letter")) ||
    (lowerName.includes("ankeiler") && !lowerName.includes("omslag"))
  ) {
    return "chapeau";
  }

  // Author patterns
  if (
    lowerName.includes("auteur") ||
    lowerName.includes("author") ||
    lowerName.includes("geschreven")
  ) {
    return "author";
  }

  // Category/theme patterns
  if (
    lowerName.includes("rubriek") ||
    lowerName.includes("categor") ||
    lowerName.includes("thema")
  ) {
    return "category";
  }

  // Body text patterns (check after more specific patterns)
  if (
    lowerName.includes("platte-tekst") ||
    lowerName.includes("plattetekst") ||
    lowerName.includes("brood") ||
    lowerName.includes("body") ||
    lowerName.includes("basistekst")
  ) {
    return "body";
  }

  // Article boundary patterns
  // Exclude "introletter" - that's a drop cap styling class, not an article boundary
  if ((lowerName.includes("artikel") || lowerName.includes("article")) && !lowerName.includes("introletter")) {
    return "article-boundary";
  }

  return null;
}

/**
 * Style category arrays holder for cleaner function signatures
 */
interface StyleCategories {
  classMap: Map<string, string>;
  titleClasses: string[];
  chapeauClasses: string[];
  bodyClasses: string[];
  authorClasses: string[];
  categoryClasses: string[];
  articleBoundaryClasses: string[];
  subheadingClasses: string[];
  streamerClasses: string[];
  sidebarClasses: string[];
  captionClasses: string[];
  coverTitleClasses: string[];
  coverChapeauClasses: string[];
  introVerseClasses: string[];
  authorBioClasses: string[];
  verseReferenceClasses: string[];
  questionClasses: string[];
}

/**
 * Add a class to the appropriate category arrays and classMap
 */
function addClassToCategories(
  className: string,
  category: string,
  categories: StyleCategories
): void {
  // Skip if already classified
  if (categories.classMap.has(className)) return;

  categories.classMap.set(className, category);

  switch (category) {
    case "title":
      categories.titleClasses.push(className);
      break;
    case "chapeau":
      categories.chapeauClasses.push(className);
      break;
    case "body":
      categories.bodyClasses.push(className);
      break;
    case "author":
      categories.authorClasses.push(className);
      break;
    case "category":
      categories.categoryClasses.push(className);
      break;
    case "article-boundary":
      categories.articleBoundaryClasses.push(className);
      break;
    case "subheading":
      categories.subheadingClasses.push(className);
      break;
    case "streamer":
      categories.streamerClasses.push(className);
      break;
    case "sidebar":
      categories.sidebarClasses.push(className);
      break;
    case "caption":
      categories.captionClasses.push(className);
      break;
    case "cover-title":
      categories.coverTitleClasses.push(className);
      break;
    case "cover-chapeau":
      categories.coverChapeauClasses.push(className);
      break;
    case "intro-verse":
      categories.introVerseClasses.push(className);
      break;
    case "author-bio":
      categories.authorBioClasses.push(className);
      break;
    case "verse-reference":
      categories.verseReferenceClasses.push(className);
      break;
    case "question":
      categories.questionClasses.push(className);
      break;
  }
}

/**
 * Create empty style categories
 */
function createEmptyCategories(): StyleCategories {
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
 * Log style analysis results
 */
function logStyleAnalysis(categories: StyleCategories, source: string): void {
  console.log(`[Structure Analyzer] Found ${source} class patterns:`);
  console.log(`  - Title classes: ${categories.titleClasses.join(", ") || "none"}`);
  console.log(`  - Chapeau classes: ${categories.chapeauClasses.join(", ") || "none"}`);
  console.log(`  - Body classes: ${categories.bodyClasses.join(", ") || "none"}`);
  console.log(`  - Author classes: ${categories.authorClasses.join(", ") || "none"}`);
  console.log(`  - Category classes: ${categories.categoryClasses.join(", ") || "none"}`);
  console.log(`  - Subheading classes: ${categories.subheadingClasses.join(", ") || "none"}`);
  console.log(`  - Streamer classes: ${categories.streamerClasses.join(", ") || "none"}`);
  console.log(`  - Sidebar classes: ${categories.sidebarClasses.join(", ") || "none"}`);
  console.log(`  - Caption classes: ${categories.captionClasses.join(", ") || "none"}`);
  console.log(`  - Cover title classes: ${categories.coverTitleClasses.join(", ") || "none"}`);
  console.log(`  - Cover chapeau classes: ${categories.coverChapeauClasses.join(", ") || "none"}`);
  console.log(`  - Intro verse classes: ${categories.introVerseClasses.join(", ") || "none"}`);
  console.log(`  - Verse reference classes: ${categories.verseReferenceClasses.join(", ") || "none"}`);
  console.log(`  - Author bio classes: ${categories.authorBioClasses.join(", ") || "none"}`);
  console.log(`  - Question classes: ${categories.questionClasses.join(", ") || "none"}`);
  console.log(`  - Article boundary classes: ${categories.articleBoundaryClasses.join(", ") || "none"}`);
}

/**
 * Convert StyleCategories to StyleAnalysis
 */
function categoriesToStyleAnalysis(categories: StyleCategories): StyleAnalysis {
  return {
    classMap: categories.classMap,
    articleBoundaryClasses: categories.articleBoundaryClasses,
    titleClasses: categories.titleClasses,
    chapeauClasses: categories.chapeauClasses,
    bodyClasses: categories.bodyClasses,
    authorClasses: categories.authorClasses,
    categoryClasses: categories.categoryClasses,
    subheadingClasses: categories.subheadingClasses,
    streamerClasses: categories.streamerClasses,
    sidebarClasses: categories.sidebarClasses,
    captionClasses: categories.captionClasses,
    coverTitleClasses: categories.coverTitleClasses,
    coverChapeauClasses: categories.coverChapeauClasses,
    introVerseClasses: categories.introVerseClasses,
    authorBioClasses: categories.authorBioClasses,
    verseReferenceClasses: categories.verseReferenceClasses,
    questionClasses: categories.questionClasses,
  };
}

/**
 * Analyze CSS files from InDesign XHTML export to identify semantic class patterns
 *
 * @param cssDir - Directory containing CSS files
 * @returns StyleAnalysis with categorized classes
 */
export async function analyzeStyles(cssDir: string): Promise<StyleAnalysis> {
  const categories = createEmptyCategories();

  try {
    const files = await readdir(cssDir);

    for (const file of files) {
      const fileName = typeof file === "string" ? file : String(file);
      if (!fileName.endsWith(".css")) continue;

      const content = await readFile(join(cssDir, fileName), "utf-8");

      // Parse CSS for class definitions
      const classRegex = /\.([A-Za-z_][\w-]*)\s*\{/g;
      let match;

      while ((match = classRegex.exec(content)) !== null) {
        const className = match[1];
        const category = classifyClassName(className);

        if (category) {
          addClassToCategories(className, category, categories);
        }
      }
    }
  } catch (error) {
    console.error("[Structure Analyzer] Error analyzing CSS:", error);
  }

  logStyleAnalysis(categories, "CSS");

  return categoriesToStyleAnalysis(categories);
}

/**
 * Analyze HTML files to extract class names used in the document
 *
 * InDesign XHTML exports often have semantic class names in HTML that aren't
 * defined in the CSS files (only referenced). This function extracts those classes.
 *
 * @param htmlDir - Directory containing HTML files
 * @returns StyleAnalysis with categorized classes found in HTML
 */
export async function analyzeHtmlClasses(
  htmlDir: string
): Promise<StyleAnalysis> {
  const categories = createEmptyCategories();

  try {
    const files = await readdir(htmlDir);

    for (const file of files) {
      const fileName = typeof file === "string" ? file : String(file);
      if (!fileName.endsWith(".html")) continue;

      const content = await readFile(join(htmlDir, fileName), "utf-8");

      // Extract all class attribute values from HTML
      const classAttrRegex = /class="([^"]*)"/g;
      let match;

      while ((match = classAttrRegex.exec(content)) !== null) {
        // Split multiple classes in one attribute
        const classes = match[1].split(/\s+/);

        for (const className of classes) {
          if (!className) continue;

          const category = classifyClassName(className);
          if (category) {
            addClassToCategories(className, category, categories);
          }
        }
      }
    }
  } catch (error) {
    console.error("[Structure Analyzer] Error analyzing HTML classes:", error);
  }

  logStyleAnalysis(categories, "HTML");

  return categoriesToStyleAnalysis(categories);
}

/**
 * Merge two StyleAnalysis objects, combining their class lists
 */
export function mergeStyleAnalysis(
  a: StyleAnalysis,
  b: StyleAnalysis
): StyleAnalysis {
  const classMap = new Map([...a.classMap, ...b.classMap]);

  // Helper to merge arrays without duplicates
  const mergeArrays = (arr1: string[], arr2: string[]): string[] => {
    return [...new Set([...arr1, ...arr2])];
  };

  return {
    classMap,
    articleBoundaryClasses: mergeArrays(
      a.articleBoundaryClasses,
      b.articleBoundaryClasses
    ),
    titleClasses: mergeArrays(a.titleClasses, b.titleClasses),
    chapeauClasses: mergeArrays(a.chapeauClasses, b.chapeauClasses),
    bodyClasses: mergeArrays(a.bodyClasses, b.bodyClasses),
    authorClasses: mergeArrays(a.authorClasses, b.authorClasses),
    categoryClasses: mergeArrays(a.categoryClasses, b.categoryClasses),
    subheadingClasses: mergeArrays(a.subheadingClasses, b.subheadingClasses),
    streamerClasses: mergeArrays(a.streamerClasses, b.streamerClasses),
    sidebarClasses: mergeArrays(a.sidebarClasses, b.sidebarClasses),
    captionClasses: mergeArrays(a.captionClasses, b.captionClasses),
    coverTitleClasses: mergeArrays(a.coverTitleClasses || [], b.coverTitleClasses || []),
    coverChapeauClasses: mergeArrays(a.coverChapeauClasses || [], b.coverChapeauClasses || []),
    introVerseClasses: mergeArrays(a.introVerseClasses || [], b.introVerseClasses || []),
    authorBioClasses: mergeArrays(a.authorBioClasses || [], b.authorBioClasses || []),
    verseReferenceClasses: mergeArrays(a.verseReferenceClasses || [], b.verseReferenceClasses || []),
    questionClasses: mergeArrays(a.questionClasses || [], b.questionClasses || []),
  };
}
