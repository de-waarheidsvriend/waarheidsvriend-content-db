import { copyFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import type { PrismaClient, Author, ArticleAuthor } from "@prisma/client";
import type {
  ExtractedArticle,
  ExtractedAuthor,
  AuthorExtractionResult,
  XhtmlExport,
} from "@/types";
import { htmlToPlainText } from "./html-cleaner";

/**
 * Extract authors from articles and XHTML export
 *
 * With the new title→■ boundary detection, author elements are already grouped
 * with their articles. This function uses article.authorNames (extracted during
 * article parsing) instead of doing spread-level matching.
 *
 * @param articles - Array of extracted articles from extractArticles()
 * @param xhtmlExport - The loaded XHTML export containing styles and images
 * @returns Array of extracted authors with photo info
 */
export function extractAuthorsFromArticles(
  articles: ExtractedArticle[],
  xhtmlExport: XhtmlExport
): AuthorExtractionResult {
  const errors: string[] = [];
  const authorMap = new Map<string, ExtractedAuthor>();

  console.log(
    `[Author Extractor] Processing ${articles.length} articles for author extraction`
  );

  // Process each article for authors
  // Authors are now pre-extracted via title→■ boundaries in article.authorNames
  for (const article of articles) {
    try {
      // Use authorNames from article (already extracted between title and ■)
      const authorNames = article.authorNames || [];

      for (const rawName of authorNames) {
        const normalizedName = normalizeName(rawName);
        if (!normalizedName) continue;

        if (authorMap.has(normalizedName)) {
          // Add article to existing author
          const existing = authorMap.get(normalizedName)!;
          if (!existing.articleTitles.includes(article.title)) {
            existing.articleTitles.push(article.title);
          }
        } else {
          // Create new author entry
          // First check if article identified this as an author photo via DOM position
          let photoInfo = { filename: null as string | null, sourcePath: null as string | null };

          // Try to find author photo from article's authorPhotoFilenames (DOM-based detection)
          if (article.authorPhotoFilenames && article.authorPhotoFilenames.size > 0) {
            // Use the first photo that matches any part of the author name
            const nameParts = normalizedName.toLowerCase().split(" ");
            for (const photoFilename of article.authorPhotoFilenames) {
              const photoLower = photoFilename.toLowerCase();
              const lastName = nameParts[nameParts.length - 1];
              if (photoLower.includes(lastName)) {
                const sourcePath = xhtmlExport.images.images.get(photoFilename) || null;
                photoInfo = { filename: photoFilename, sourcePath };
                break;
              }
            }
          }

          // Fallback to traditional photo matching if DOM-based didn't find anything
          if (!photoInfo.filename) {
            photoInfo = matchAuthorPhoto(
              normalizedName,
              xhtmlExport.images.authorPhotos,
              xhtmlExport.images.images
            );
          }

          authorMap.set(normalizedName, {
            name: normalizedName,
            photoFilename: photoInfo.filename,
            photoSourcePath: photoInfo.sourcePath,
            articleTitles: [article.title],
          });
        }
      }
    } catch (error) {
      const errorMsg = `Failed to extract authors from article "${article.title}": ${error}`;
      errors.push(errorMsg);
      console.error(`[Author Extractor] ${errorMsg}`);
    }
  }

  const authors = Array.from(authorMap.values());
  console.log(
    `[Author Extractor] Extracted ${authors.length} unique authors from ${articles.length} articles`
  );

  return { authors, errors };
}

/**
 * Parse author names from author text elements
 *
 * Handles multiple authors separated by:
 * - "en" (Dutch "and")
 * - "&"
 * - ","
 * - "and" (English)
 */
export function parseAuthorNames(authorTexts: string[]): string[] {
  const names: string[] = [];

  for (const text of authorTexts) {
    // Clean the text
    const cleaned = htmlToPlainText(text).trim();
    if (!cleaned) continue;

    // Split by common separators
    // Order matters: check "en" before splitting on comma to handle "Jan en Piet, Klaas"
    const parts = cleaned
      // Replace separators with pipe for splitting
      .replace(/\s+en\s+/gi, "|")
      .replace(/\s+and\s+/gi, "|")
      .replace(/\s*&\s*/g, "|")
      .replace(/\s*,\s*/g, "|")
      .split("|")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    names.push(...parts);
  }

  // Deduplicate while preserving order
  return [...new Set(names)];
}

/**
 * Normalize author name for consistency
 */
export function normalizeName(name: string): string {
  // Remove extra whitespace
  let normalized = name.replace(/\s+/g, " ").trim();

  // Remove common prefixes like "Door:" or "Tekst:" (colon optional for some)
  normalized = normalized.replace(/^(door|tekst|text|auteur|author):\s*/i, "");
  // Also handle "by" prefix without colon (English)
  normalized = normalized.replace(/^by\s+/i, "");

  // Remove trailing punctuation
  normalized = normalized.replace(/[.,;:!?]+$/, "").trim();

  return normalized;
}

/**
 * Match author name to photo filename
 *
 * Uses fuzzy matching based on last name
 */
export function matchAuthorPhoto(
  authorName: string,
  authorPhotos: string[],
  imageMap: Map<string, string>
): { filename: string | null; sourcePath: string | null } {
  if (authorPhotos.length === 0) {
    return { filename: null, sourcePath: null };
  }

  const nameLower = authorName.toLowerCase();
  const nameParts = nameLower.split(" ");
  const lastName = nameParts[nameParts.length - 1];

  // First try: exact match on full name (normalized for filename)
  const normalizedName = nameLower.replace(/\s+/g, "-");
  for (const photo of authorPhotos) {
    const photoLower = photo.toLowerCase();
    if (photoLower.includes(normalizedName)) {
      const sourcePath = imageMap.get(photo) || null;
      return { filename: photo, sourcePath };
    }
  }

  // Second try: match on last name only
  for (const photo of authorPhotos) {
    const photoLower = photo.toLowerCase();
    if (photoLower.includes(lastName)) {
      const sourcePath = imageMap.get(photo) || null;
      return { filename: photo, sourcePath };
    }
  }

  // Third try: match any name part
  for (const part of nameParts) {
    if (part.length < 3) continue; // Skip initials
    for (const photo of authorPhotos) {
      const photoLower = photo.toLowerCase();
      if (photoLower.includes(part)) {
        const sourcePath = imageMap.get(photo) || null;
        return { filename: photo, sourcePath };
      }
    }
  }

  return { filename: null, sourcePath: null };
}

/**
 * Result of saving authors to the database
 */
export interface SaveAuthorsResult {
  authors: Author[];
  articleAuthorRelations: ArticleAuthor[];
  errors: string[];
}

/**
 * Save extracted authors to the database and create article relationships
 *
 * @param prisma - Prisma client instance
 * @param editionId - The ID of the edition (for photo path)
 * @param extractedAuthors - Array of extracted authors
 * @param articleMap - Map of article title to article ID
 * @param xhtmlRootDir - Root directory of XHTML export (for photo source)
 * @param uploadsDir - Base uploads directory
 * @returns Object with created/updated Authors, relations, and errors
 */
export async function saveAuthors(
  prisma: PrismaClient,
  editionId: number,
  extractedAuthors: ExtractedAuthor[],
  articleMap: Map<string, number>,
  xhtmlRootDir: string,
  uploadsDir: string
): Promise<SaveAuthorsResult> {
  const errors: string[] = [];
  const savedAuthors: Author[] = [];
  const savedRelations: ArticleAuthor[] = [];

  console.log(
    `[Author Extractor] Saving ${extractedAuthors.length} authors for edition ${editionId}`
  );

  if (extractedAuthors.length === 0) {
    return { authors: [], articleAuthorRelations: [], errors: [] };
  }

  // Create author photos directory
  const authorPhotosDir = join(
    uploadsDir,
    "editions",
    String(editionId),
    "images",
    "authors"
  );
  try {
    await mkdir(authorPhotosDir, { recursive: true });
  } catch (error) {
    console.warn(`[Author Extractor] Could not create photos dir: ${error}`);
  }

  for (const extractedAuthor of extractedAuthors) {
    try {
      // Copy photo if available
      let photoUrl: string | null = null;
      if (extractedAuthor.photoSourcePath) {
        try {
          const sourcePath = join(xhtmlRootDir, extractedAuthor.photoSourcePath);
          const destFilename = extractedAuthor.photoFilename || basename(sourcePath);
          const destPath = join(authorPhotosDir, destFilename);

          await copyFile(sourcePath, destPath);
          photoUrl = `/uploads/editions/${editionId}/images/authors/${destFilename}`;
          console.log(`[Author Extractor] Copied photo for ${extractedAuthor.name}`);
        } catch (copyError) {
          console.warn(
            `[Author Extractor] Could not copy photo for ${extractedAuthor.name}: ${copyError}`
          );
        }
      }

      // Upsert author: find existing or create new
      const author = await prisma.author.upsert({
        where: { name: extractedAuthor.name },
        update: {
          // Only update photo_url if we have a new one and there isn't one already
          photo_url: photoUrl || undefined,
        },
        create: {
          name: extractedAuthor.name,
          photo_url: photoUrl,
        },
      });

      savedAuthors.push(author);

      // Create article-author relationships
      for (const articleTitle of extractedAuthor.articleTitles) {
        const articleId = articleMap.get(articleTitle);
        if (!articleId) {
          console.warn(
            `[Author Extractor] No article ID found for title: ${articleTitle}`
          );
          continue;
        }

        try {
          // Use upsert to handle duplicate relationships gracefully
          const relation = await prisma.articleAuthor.upsert({
            where: {
              article_id_author_id: {
                article_id: articleId,
                author_id: author.id,
              },
            },
            update: {},
            create: {
              article_id: articleId,
              author_id: author.id,
            },
          });
          savedRelations.push(relation);
        } catch (relationError) {
          const msg = `Failed to create relation for article ${articleId} and author ${author.id}: ${relationError}`;
          errors.push(msg);
          console.error(`[Author Extractor] ${msg}`);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to save author ${extractedAuthor.name}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Author Extractor] ${errorMsg}`);
      // Continue with next author (graceful degradation)
    }
  }

  console.log(
    `[Author Extractor] Saved ${savedAuthors.length} authors, ${savedRelations.length} relations`
  );

  return {
    authors: savedAuthors,
    articleAuthorRelations: savedRelations,
    errors,
  };
}
