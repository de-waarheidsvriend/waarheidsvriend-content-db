import { readFile, readdir } from "fs/promises";
import { join } from "path";
import * as cheerio from "cheerio";
import type { EditionMetadata } from "@/types";

// Re-export the type for convenience
export type { EditionMetadata } from "@/types";

const DUTCH_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

export function parseDate(day: string, month: string, year: string): Date {
  const monthIndex = DUTCH_MONTHS[month.toLowerCase()];
  return new Date(parseInt(year), monthIndex, parseInt(day));
}

async function findHtmlDir(xhtmlDir: string): Promise<string | null> {
  // First, try the direct path (xhtmlDir/publication-web-resources/html)
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
      const subPath = join(xhtmlDir, entry, "publication-web-resources", "html");
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

export async function extractMetadata(
  xhtmlDir: string
): Promise<EditionMetadata> {
  // Find HTML files in the publication-web-resources/html/ directory
  const htmlDir = await findHtmlDir(xhtmlDir);

  if (!htmlDir) {
    console.warn("[Metadata Extractor] Could not find HTML directory in:", xhtmlDir);
    return { editionNumber: null, editionDate: null };
  }

  try {
    const files = await readdir(htmlDir);
    const htmlFiles = files.filter((f) =>
      typeof f === "string" ? f.endsWith(".html") : false
    );

    for (const file of htmlFiles) {
      const fileName = typeof file === "string" ? file : String(file);
      const content = await readFile(join(htmlDir, fileName), "utf-8");
      const $ = cheerio.load(content);

      // Get all text content from body
      const text = $("body").text();

      // Look for edition number patterns
      // Matches "Jaargang 42" or "Nr. 123" or "Nr 123"
      const editionMatch = text.match(/(?:Jaargang|Nr\.?)\s*(\d+)/i);

      // Look for date patterns
      // Matches "15 januari 2026" format
      const dateMatch = text.match(
        /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i
      );

      if (editionMatch || dateMatch) {
        return {
          editionNumber: editionMatch ? parseInt(editionMatch[1]) : null,
          editionDate: dateMatch
            ? parseDate(dateMatch[1], dateMatch[2], dateMatch[3])
            : null,
        };
      }
    }
  } catch (error) {
    console.error("[Metadata Extractor] Error:", error);
  }

  return { editionNumber: null, editionDate: null };
}
