import { readFile, readdir } from "fs/promises";
import { join } from "path";
import type { StyleAnalysis } from "@/types";

/**
 * Classify a class name into a semantic category based on Dutch/English naming patterns
 */
function classifyClassName(className: string): string | null {
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

  // Title patterns: kop, hoofdkop, titel, title
  if (
    lowerName.includes("hoofdkop") ||
    lowerName.includes("titel") ||
    lowerName.includes("title") ||
    (lowerName.includes("kop") &&
      !lowerName.includes("tussenkop") &&
      !lowerName.includes("streamer"))
  ) {
    return "title";
  }

  // Chapeau/intro patterns
  if (
    lowerName.includes("chapeau") ||
    lowerName.includes("intro") ||
    lowerName.includes("ankeiler")
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
    lowerName.includes("basistekst") ||
    lowerName.includes("kadertekst")
  ) {
    return "body";
  }

  // Article boundary patterns
  if (lowerName.includes("artikel") || lowerName.includes("article")) {
    return "article-boundary";
  }

  return null;
}

/**
 * Add a class to the appropriate category arrays and classMap
 */
function addClassToCategories(
  className: string,
  category: string,
  classMap: Map<string, string>,
  titleClasses: string[],
  chapeauClasses: string[],
  bodyClasses: string[],
  authorClasses: string[],
  categoryClasses: string[],
  articleBoundaryClasses: string[]
): void {
  // Skip if already classified
  if (classMap.has(className)) return;

  classMap.set(className, category);

  switch (category) {
    case "title":
      titleClasses.push(className);
      break;
    case "chapeau":
      chapeauClasses.push(className);
      break;
    case "body":
      bodyClasses.push(className);
      break;
    case "author":
      authorClasses.push(className);
      break;
    case "category":
      categoryClasses.push(className);
      break;
    case "article-boundary":
      articleBoundaryClasses.push(className);
      break;
  }
}

/**
 * Analyze CSS files from InDesign XHTML export to identify semantic class patterns
 *
 * @param cssDir - Directory containing CSS files
 * @returns StyleAnalysis with categorized classes
 */
export async function analyzeStyles(cssDir: string): Promise<StyleAnalysis> {
  const classMap = new Map<string, string>();
  const articleBoundaryClasses: string[] = [];
  const titleClasses: string[] = [];
  const chapeauClasses: string[] = [];
  const bodyClasses: string[] = [];
  const authorClasses: string[] = [];
  const categoryClasses: string[] = [];

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
          addClassToCategories(
            className,
            category,
            classMap,
            titleClasses,
            chapeauClasses,
            bodyClasses,
            authorClasses,
            categoryClasses,
            articleBoundaryClasses
          );
        }
      }
    }
  } catch (error) {
    console.error("[Structure Analyzer] Error analyzing CSS:", error);
  }

  console.log("[Structure Analyzer] Found class patterns:");
  console.log(`  - Title classes: ${titleClasses.join(", ") || "none"}`);
  console.log(`  - Chapeau classes: ${chapeauClasses.join(", ") || "none"}`);
  console.log(`  - Body classes: ${bodyClasses.join(", ") || "none"}`);
  console.log(`  - Author classes: ${authorClasses.join(", ") || "none"}`);
  console.log(`  - Category classes: ${categoryClasses.join(", ") || "none"}`);
  console.log(
    `  - Article boundary classes: ${articleBoundaryClasses.join(", ") || "none"}`
  );

  return {
    classMap,
    articleBoundaryClasses,
    titleClasses,
    chapeauClasses,
    bodyClasses,
    authorClasses,
    categoryClasses,
  };
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
  const classMap = new Map<string, string>();
  const articleBoundaryClasses: string[] = [];
  const titleClasses: string[] = [];
  const chapeauClasses: string[] = [];
  const bodyClasses: string[] = [];
  const authorClasses: string[] = [];
  const categoryClasses: string[] = [];

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
            addClassToCategories(
              className,
              category,
              classMap,
              titleClasses,
              chapeauClasses,
              bodyClasses,
              authorClasses,
              categoryClasses,
              articleBoundaryClasses
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[Structure Analyzer] Error analyzing HTML classes:", error);
  }

  console.log("[Structure Analyzer] Found HTML class patterns:");
  console.log(`  - Title classes: ${titleClasses.join(", ") || "none"}`);
  console.log(`  - Chapeau classes: ${chapeauClasses.join(", ") || "none"}`);
  console.log(`  - Body classes: ${bodyClasses.join(", ") || "none"}`);
  console.log(`  - Author classes: ${authorClasses.join(", ") || "none"}`);
  console.log(`  - Category classes: ${categoryClasses.join(", ") || "none"}`);
  console.log(
    `  - Article boundary classes: ${articleBoundaryClasses.join(", ") || "none"}`
  );

  return {
    classMap,
    articleBoundaryClasses,
    titleClasses,
    chapeauClasses,
    bodyClasses,
    authorClasses,
    categoryClasses,
  };
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
  };
}
