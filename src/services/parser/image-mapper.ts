import { copyFile, mkdir } from "fs/promises";
import { join } from "path";
import type { PrismaClient, Image } from "@prisma/client";
import type {
  ExtractedArticle,
  ExtractedImage,
  ImageMappingResult,
  XhtmlExport,
} from "@/types";

/**
 * Extract and map images from articles to their source files
 *
 * This function analyzes extracted articles to build a complete mapping of
 * images, including their captions and featured status.
 *
 * @param articles - Array of extracted articles with referencedImages and captions
 * @param xhtmlExport - The loaded XHTML export containing image index
 * @returns Array of extracted images with metadata
 */
export function mapImagesToArticles(
  articles: ExtractedArticle[],
  xhtmlExport: XhtmlExport
): ImageMappingResult {
  const errors: string[] = [];
  const images: ExtractedImage[] = [];

  console.log(
    `[Image Mapper] Processing ${articles.length} articles for image mapping`
  );

  for (const article of articles) {
    try {
      const articleImages = extractImagesForArticle(article, xhtmlExport);
      images.push(...articleImages);
    } catch (error) {
      const errorMsg = `Failed to map images for article "${article.title}": ${error}`;
      errors.push(errorMsg);
      console.error(`[Image Mapper] ${errorMsg}`);
    }
  }

  console.log(
    `[Image Mapper] Mapped ${images.length} images from ${articles.length} articles`
  );

  return { images, errors };
}

/**
 * Extract images for a single article
 */
function extractImagesForArticle(
  article: ExtractedArticle,
  xhtmlExport: XhtmlExport
): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const { referencedImages, captions } = article;

  // Filter out decorative/logo images and advertisements
  const contentImages = referencedImages.filter((filename) => {
    const lowerFilename = filename.toLowerCase();
    return (
      !lowerFilename.includes("logo") &&
      !lowerFilename.includes("icon") &&
      !lowerFilename.startsWith("adv_") &&
      !lowerFilename.includes("advertentie") &&
      !lowerFilename.startsWith("data:") // Skip inline base64 images
    );
  });

  for (let i = 0; i < contentImages.length; i++) {
    const filename = contentImages[i];
    const sourcePath = xhtmlExport.images.images.get(filename);

    if (!sourcePath) {
      console.warn(
        `[Image Mapper] Image file not found in index: ${filename} for article "${article.title}"`
      );
      continue;
    }

    // Get caption from article's captions map
    const caption = captions.get(filename) || null;

    // First image is featured
    const isFeatured = i === 0;

    images.push({
      filename,
      sourcePath,
      caption,
      isFeatured,
      sortOrder: i,
      articleTitle: article.title,
    });
  }

  return images;
}

/**
 * Result of saving images to the database
 */
export interface SaveImagesResult {
  images: Image[];
  errors: string[];
}

/**
 * Save extracted images to the database and copy files
 *
 * @param prisma - Prisma client instance
 * @param editionId - The ID of the edition (for image path)
 * @param extractedImages - Array of extracted images
 * @param articleMap - Map of article title to article ID
 * @param xhtmlRootDir - Root directory of XHTML export (for image source)
 * @param uploadsDir - Base uploads directory
 * @returns Object with created Image records and errors
 */
export async function saveImages(
  prisma: PrismaClient,
  editionId: number,
  extractedImages: ExtractedImage[],
  articleMap: Map<string, number>,
  xhtmlRootDir: string,
  uploadsDir: string
): Promise<SaveImagesResult> {
  const errors: string[] = [];
  const savedImages: Image[] = [];

  console.log(
    `[Image Mapper] Saving ${extractedImages.length} images for edition ${editionId}`
  );

  if (extractedImages.length === 0) {
    return { images: [], errors: [] };
  }

  // Create article images directory
  const articleImagesDir = join(
    uploadsDir,
    "editions",
    String(editionId),
    "images",
    "articles"
  );
  try {
    await mkdir(articleImagesDir, { recursive: true });
  } catch (error) {
    console.warn(`[Image Mapper] Could not create images dir: ${error}`);
  }

  for (const extractedImage of extractedImages) {
    try {
      // Get article ID from map
      const articleId = articleMap.get(extractedImage.articleTitle);
      if (!articleId) {
        console.warn(
          `[Image Mapper] No article ID found for title: ${extractedImage.articleTitle}`
        );
        continue;
      }

      // Copy image file
      let imageUrl: string | null = null;
      try {
        const sourcePath = join(xhtmlRootDir, extractedImage.sourcePath);
        const destFilename = extractedImage.filename;
        const destPath = join(articleImagesDir, destFilename);

        await copyFile(sourcePath, destPath);
        imageUrl = `/uploads/editions/${editionId}/images/articles/${destFilename}`;
        console.log(
          `[Image Mapper] Copied image ${destFilename} for article "${extractedImage.articleTitle}"`
        );
      } catch (copyError) {
        const msg = `Could not copy image ${extractedImage.filename}: ${copyError}`;
        errors.push(msg);
        console.warn(`[Image Mapper] ${msg}`);
        continue; // Skip this image if copy failed
      }

      // Create image record in database
      const image = await prisma.image.create({
        data: {
          article_id: articleId,
          url: imageUrl,
          caption: extractedImage.caption,
          is_featured: extractedImage.isFeatured,
          sort_order: extractedImage.sortOrder,
        },
      });

      savedImages.push(image);
    } catch (error) {
      const errorMsg = `Failed to save image ${extractedImage.filename}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Image Mapper] ${errorMsg}`);
      // Continue with next image (graceful degradation)
    }
  }

  console.log(
    `[Image Mapper] Saved ${savedImages.length} images, ${errors.length} errors`
  );

  return { images: savedImages, errors };
}

/**
 * Find featured image for an article
 *
 * @param extractedImages - Array of extracted images
 * @param articleTitle - Title of the article
 * @returns The featured image URL or null if not found
 */
export function getFeaturedImageUrl(
  extractedImages: ExtractedImage[],
  articleTitle: string
): string | null {
  const featuredImage = extractedImages.find(
    (img) => img.articleTitle === articleTitle && img.isFeatured
  );
  return featuredImage ? featuredImage.sourcePath : null;
}
