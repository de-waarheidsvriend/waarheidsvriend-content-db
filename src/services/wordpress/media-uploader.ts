/**
 * Media Uploader
 *
 * Uploads local images to WordPress Media Library.
 * Handles featured images and author photos.
 */

import { readFile } from "fs/promises";
import { join, basename, extname } from "path";
import { existsSync } from "fs";
import type { WpCredentials, WpMediaUploadResult, LocalArticleData } from "./types";
import { createAuthHeader, WordPressApiError } from "./api-client";

/**
 * Upload an image to WordPress Media Library
 */
export async function uploadImage(
  localPath: string,
  filename: string,
  credentials: WpCredentials
): Promise<WpMediaUploadResult> {
  // Read the file
  const buffer = await readFile(localPath);

  // Determine content type from extension
  const ext = extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";

  // Create multipart form data
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;

  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );

  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([prefix, buffer, suffix]);

  const url = `${credentials.apiUrl}/media`;
  const authHeader = createAuthHeader(credentials);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new WordPressApiError(
      `Failed to upload image: ${errorMessage}`,
      "UPLOAD_FAILED",
      response.status
    );
  }

  return response.json();
}

/**
 * Resolve a local image URL to an absolute file path
 *
 * Image URLs are stored as relative paths like:
 * /uploads/editions/123/xhtml/images/image.jpg
 *
 * This resolves them to absolute paths on the filesystem.
 */
export function resolveLocalImagePath(
  imageUrl: string,
  uploadsDir: string
): string {
  // Remove leading slash and 'uploads/' prefix if present
  let relativePath = imageUrl;

  if (relativePath.startsWith("/uploads/")) {
    relativePath = relativePath.substring("/uploads/".length);
  } else if (relativePath.startsWith("uploads/")) {
    relativePath = relativePath.substring("uploads/".length);
  } else if (relativePath.startsWith("/")) {
    relativePath = relativePath.substring(1);
  }

  return join(uploadsDir, relativePath);
}

/**
 * Upload the featured image for an article
 * Returns the WordPress media ID or null if no featured image
 */
export async function uploadFeaturedImage(
  article: LocalArticleData,
  uploadsDir: string,
  credentials: WpCredentials
): Promise<number | null> {
  // Find featured image
  const featuredImage =
    article.images.find((img) => img.isFeatured) ||
    (article.images.length > 0
      ? [...article.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
      : null);

  if (!featuredImage) {
    return null;
  }

  const localPath = resolveLocalImagePath(featuredImage.url, uploadsDir);

  // Check if file exists
  if (!existsSync(localPath)) {
    console.warn(
      `[MediaUploader] Featured image not found: ${localPath} for article ${article.id}`
    );
    return null;
  }

  try {
    const filename = basename(featuredImage.url);
    const result = await uploadImage(localPath, filename, credentials);
    return result.id;
  } catch (error) {
    console.error(
      `[MediaUploader] Failed to upload featured image for article ${article.id}:`,
      error
    );
    return null;
  }
}

/**
 * Upload an author's photo to WordPress
 * Returns the WordPress media ID or null if no photo
 */
export async function uploadAuthorPhoto(
  authorName: string,
  photoUrl: string | null,
  uploadsDir: string,
  credentials: WpCredentials
): Promise<number | null> {
  if (!photoUrl) {
    return null;
  }

  const localPath = resolveLocalImagePath(photoUrl, uploadsDir);

  // Check if file exists
  if (!existsSync(localPath)) {
    console.warn(
      `[MediaUploader] Author photo not found: ${localPath} for author ${authorName}`
    );
    return null;
  }

  try {
    const filename = basename(photoUrl);
    const result = await uploadImage(localPath, filename, credentials);
    return result.id;
  } catch (error) {
    console.error(
      `[MediaUploader] Failed to upload author photo for ${authorName}:`,
      error
    );
    return null;
  }
}

/**
 * Get the uploads directory path
 * Default is 'uploads' relative to project root
 */
export function getUploadsDir(): string {
  // In Next.js, process.cwd() returns the project root
  return join(process.cwd(), "uploads");
}
