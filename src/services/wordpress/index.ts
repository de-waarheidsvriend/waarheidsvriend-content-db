/**
 * WordPress Publishing Service
 *
 * Main orchestration module for publishing editions to WordPress.
 * Coordinates all sub-services: API client, article mapper, media uploader, author sync.
 */

import type { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { basename } from "path";
import { prisma } from "@/lib/db";

import type {
  WpCredentials,
  PublishResult,
  PublishOptions,
  PublishProgress,
  ArticlePublishResult,
  LocalArticleData,
  LocalEditionData,
} from "./types";

import {
  getCredentialsFromEnv,
  validateCredentials as validateWpCredentials,
  getArticleBySlug,
  createArticle,
  updateArticle,
} from "./api-client";

import {
  mapArticleToWpPayload,
  generateArticleSlug,
  createAuthorBlock,
  createCategoryBlock,
} from "./article-mapper";

import { classifyArticleCategory } from "./category-classifier";

import {
  uploadFeaturedImage,
  uploadAuthorPhoto,
  uploadImage,
  updateMediaAltText,
  resolveLocalImagePath,
  getUploadsDir,
} from "./media-uploader";

import { createAuthHeader } from "./api-client";

import {
  buildAuthorCache,
  findOrCreateWpUser,
  clearAuthorCache,
} from "./author-sync";

// Re-export types and sub-modules for convenience
export * from "./types";
export * from "./api-client";
export * from "./article-mapper";
export * from "./media-uploader";
export * from "./author-sync";
export * from "./category-classifier";

/**
 * Rate limiting delay between WordPress API calls (ms)
 */
const API_DELAY_MS = 100;

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load a single article from database with all related data
 */
async function loadArticleData(
  articleId: number
): Promise<{ article: LocalArticleData; editionNumber: number; editionDate: Date } | null> {
  const article = await (prisma as PrismaClient).article.findUnique({
    where: { id: articleId },
    include: {
      edition: true,
      article_authors: {
        include: {
          author: true,
        },
      },
      images: {
        orderBy: { sort_order: "asc" },
      },
    },
  });

  if (!article) {
    return null;
  }

  return {
    article: {
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      chapeau: article.chapeau,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
      authorBio: article.author_bio,
      authors: article.article_authors.map((aa) => ({
        id: aa.author.id,
        name: aa.author.name,
        photoUrl: aa.author.photo_url,
      })),
      images: article.images.map((img) => ({
        id: img.id,
        url: img.url,
        caption: img.caption,
        isFeatured: img.is_featured,
        sortOrder: img.sort_order,
      })),
    },
    editionNumber: article.edition.edition_number,
    editionDate: article.edition.edition_date,
  };
}

/**
 * Load edition data from database with all related data
 */
async function loadEditionData(editionId: number): Promise<LocalEditionData | null> {
  const edition = await (prisma as PrismaClient).edition.findUnique({
    where: { id: editionId },
    include: {
      articles: {
        include: {
          article_authors: {
            include: {
              author: true,
            },
          },
          images: {
            orderBy: { sort_order: "asc" },
          },
        },
      },
    },
  });

  if (!edition) {
    return null;
  }

  return {
    id: edition.id,
    editionNumber: edition.edition_number,
    editionDate: edition.edition_date,
    status: edition.status,
    articles: edition.articles.map((article) => ({
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      chapeau: article.chapeau,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
      authorBio: article.author_bio,
      authors: article.article_authors.map((aa) => ({
        id: aa.author.id,
        name: aa.author.name,
        photoUrl: aa.author.photo_url,
      })),
      images: article.images.map((img) => ({
        id: img.id,
        url: img.url,
        caption: img.caption,
        isFeatured: img.is_featured,
        sortOrder: img.sort_order,
      })),
    })),
  };
}

/**
 * Publish a single article to WordPress
 */
async function publishSingleArticle(
  article: LocalArticleData,
  editionNumber: number,
  editionDate: Date,
  credentials: WpCredentials,
  uploadsDir: string,
  dryRun: boolean,
  onProgress?: (progress: PublishProgress) => void,
  current?: number,
  total?: number
): Promise<ArticlePublishResult> {
  const reportProgress = (status: PublishProgress["status"]) => {
    if (onProgress && current !== undefined && total !== undefined) {
      onProgress({
        current,
        total,
        currentArticle: article.title,
        status,
      });
    }
  };

  try {
    // Step 1: Sync author(s) - skip for now
    // Note: The article_author ACF field expects a custom "author" post type,
    // not a WordPress user ID. We use the fallback author block instead.
    reportProgress("syncing_author");
    const wpAuthorId: number | undefined = undefined;

    // Step 2: Upload featured image
    reportProgress("uploading_image");
    let wpImageId: number | undefined;

    if (article.images.length > 0) {
      if (!dryRun) {
        const imageId = await uploadFeaturedImage(article, uploadsDir, credentials);
        if (imageId) {
          wpImageId = imageId;
        }
        await sleep(API_DELAY_MS);
      } else {
        const featuredUrl = article.images.find((i) => i.isFeatured)?.url ||
          article.images[0]?.url;
        console.log(`[DryRun] Would upload featured image: ${featuredUrl}`);
      }
    }

    // Step 2.5: Upload inline images (non-featured images)
    reportProgress("uploading_inline_images");
    const inlineImageIds = new Map<string, number>(); // URL → WP media ID

    for (const image of article.images) {
      // Skip featured images - they're handled separately
      if (image.isFeatured) continue;

      // Also skip the first image if no featured image was explicitly set
      // (it was used as featured image in step 2)
      const featuredImage = article.images.find((img) => img.isFeatured);
      if (!featuredImage && image.sortOrder === article.images[0]?.sortOrder) {
        continue;
      }

      const localPath = resolveLocalImagePath(image.url, uploadsDir);
      if (!existsSync(localPath)) {
        console.warn(`[WordPress] Inline image not found: ${localPath}`);
        continue;
      }

      if (!dryRun) {
        try {
          const filename = basename(image.url);
          const result = await uploadImage(localPath, filename, credentials);

          // Store alt-text (caption) on the uploaded media
          if (image.caption) {
            await updateMediaAltText(result.id, image.caption, credentials);
          }

          inlineImageIds.set(image.url, result.id);
          console.log(`[WordPress] Uploaded inline image: ${filename} (ID: ${result.id})`);
          await sleep(API_DELAY_MS);
        } catch (error) {
          console.error(`[WordPress] Failed to upload inline image ${image.url}:`, error);
        }
      } else {
        console.log(`[DryRun] Would upload inline image: ${image.url}`);
      }
    }

    // Step 3: Upload author photo and create fallback block (if no WP author ID)
    let authorPhotoUrl: string | undefined;

    if (article.authors.length > 0 && !wpAuthorId) {
      const primaryAuthor = article.authors[0];

      if (!dryRun) {
        // Upload author photo to media library
        if (primaryAuthor.photoUrl) {
          const photoMediaId = await uploadAuthorPhoto(
            primaryAuthor.name,
            primaryAuthor.photoUrl,
            uploadsDir,
            credentials
          );
          if (photoMediaId) {
            // Get the uploaded image URL from WordPress
            try {
              const mediaResponse = await fetch(
                `${credentials.apiUrl}/media/${photoMediaId}`,
                { headers: { Authorization: createAuthHeader(credentials) } }
              );
              if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                authorPhotoUrl = mediaData.source_url;
              }
            } catch (error) {
              console.warn(`[WordPress] Failed to get author photo URL:`, error);
            }
          }
          await sleep(API_DELAY_MS);
        }
      } else {
        console.log(`[DryRun] Would upload author photo and create author block for: ${primaryAuthor.name}`);
      }
    }

    // Step 3.5: Classify category via Claude AI
    reportProgress("classifying_category");
    let categoryName: string | undefined;

    if (!dryRun) {
      const classified = await classifyArticleCategory(article.title, article.content);
      if (classified) {
        categoryName = classified;
        console.log(`[WordPress] Categorie bepaald: ${categoryName}`);
      }
    } else {
      console.log(`[DryRun] Would classify article category via Claude AI`);
    }

    // Step 4: Map article to WP payload
    reportProgress("publishing");
    const payload = mapArticleToWpPayload(
      article,
      editionNumber,
      editionDate,
      wpAuthorId,
      wpImageId,
      inlineImageIds
    );

    // Debug: Log ACF payload for troubleshooting
    console.log(`[WordPress] ACF payload for "${article.title}" (ID: ${article.id}):`);
    console.log(`[WordPress]   Components count: ${payload.acf.components.length}`);
    console.log(`[WordPress]   Component types: ${payload.acf.components.map(c => c.acf_fc_layout).join(', ')}`);
    if (dryRun) {
      console.log(`[WordPress]   Full ACF payload:`, JSON.stringify(payload.acf, null, 2));
    }

    // Add category text block at the beginning of article
    if (categoryName && !dryRun) {
      const categoryBlock = createCategoryBlock(categoryName);
      payload.acf.components.unshift(categoryBlock);

      // TODO: WordPress categorie-koppeling implementeren
      // - Categorie opzoeken via /categories endpoint
      // - Als gevonden: payload.acf.article_category = categoryId
      // - Zie ClickUp taak 86c7yd7rw voor details
    }

    // Add author fallback block at the end (after paywall) if no WP author ID
    if (article.authors.length > 0 && !wpAuthorId && !dryRun) {
      const primaryAuthor = article.authors[0];
      const authorBlock = createAuthorBlock(primaryAuthor.name, authorPhotoUrl, article.authorBio);
      payload.acf.components.push(authorBlock);
    }

    if (dryRun) {
      console.log(`[DryRun] Would publish article: ${article.title}`);
      console.log(`[DryRun]   Slug: ${payload.slug}`);
      console.log(`[DryRun]   Components: ${payload.acf.components.length}`);
      console.log(`[DryRun]   Author ID: ${wpAuthorId || "none (fallback block)"}`);
      console.log(`[DryRun]   Image ID: ${wpImageId || "none"}`);

      return {
        articleId: article.id,
        title: article.title,
        success: true,
        wpSlug: payload.slug,
        created: true, // Assume would be created
      };
    }

    // Step 4: Check if article already exists (upsert)
    const existingArticle = await getArticleBySlug(payload.slug, credentials);
    await sleep(API_DELAY_MS);

    let wpResponse;
    let created: boolean;

    if (existingArticle) {
      // Update existing article
      console.log(
        `[WordPress] Updating existing article: ${payload.slug} (ID: ${existingArticle.id})`
      );
      wpResponse = await updateArticle(existingArticle.id, payload, credentials);
      created = false;
    } else {
      // Create new article
      console.log(`[WordPress] Creating new article: ${payload.slug}`);
      wpResponse = await createArticle(payload, credentials);
      created = true;
    }

    await sleep(API_DELAY_MS);

    reportProgress("completed");

    return {
      articleId: article.id,
      title: article.title,
      success: true,
      wpPostId: wpResponse.id,
      wpSlug: wpResponse.slug,
      created,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WordPress] Failed to publish article ${article.id}:`, error);

    return {
      articleId: article.id,
      title: article.title,
      success: false,
      error: errorMessage,
      created: false,
    };
  }
}

/**
 * Main entry point: Publish all articles from an edition to WordPress
 *
 * @param editionId - Database ID of the edition to publish
 * @param options - Publishing options (dryRun, progress callback)
 * @returns PublishResult with stats and individual article results
 */
export async function publishEditionToWordPress(
  editionId: number,
  options: PublishOptions = {}
): Promise<PublishResult> {
  const { dryRun = false, onProgress } = options;
  const errors: string[] = [];

  console.log(
    `[WordPress] Starting publication of edition ${editionId}${dryRun ? " (dry run)" : ""}`
  );

  // Step 1: Validate credentials
  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    return {
      success: false,
      editionId,
      articlesPublished: 0,
      articlesSkipped: 0,
      articlesFailed: 0,
      results: [],
      errors: ["WordPress credentials niet geconfigureerd. Stel WP_USERNAME, WP_APP_PASSWORD en NEXT_PUBLIC_WP_API_URL in."],
      dryRun,
    };
  }

  if (!dryRun) {
    const validation = await validateWpCredentials(credentials);
    if (!validation.valid) {
      return {
        success: false,
        editionId,
        articlesPublished: 0,
        articlesSkipped: 0,
        articlesFailed: 0,
        results: [],
        errors: [`WordPress authenticatie mislukt: ${validation.error}`],
        dryRun,
      };
    }
    console.log(`[WordPress] Authenticated as: ${validation.user?.name}`);
  }

  // Step 2: Load edition data
  const edition = await loadEditionData(editionId);
  if (!edition) {
    return {
      success: false,
      editionId,
      articlesPublished: 0,
      articlesSkipped: 0,
      articlesFailed: 0,
      results: [],
      errors: [`Editie ${editionId} niet gevonden`],
      dryRun,
    };
  }

  if (edition.articles.length === 0) {
    return {
      success: true,
      editionId,
      articlesPublished: 0,
      articlesSkipped: 0,
      articlesFailed: 0,
      results: [],
      errors: [],
      dryRun,
    };
  }

  // Step 3: Sort articles by page_start DESC (last article first)
  // This ensures WordPress displays newest (highest page number) first
  const sortedArticles = [...edition.articles].sort((a, b) => {
    const pageA = a.pageStart ?? 0;
    const pageB = b.pageStart ?? 0;
    return pageB - pageA; // Descending order
  });

  console.log(
    `[WordPress] Publishing ${sortedArticles.length} articles in reverse page order`
  );

  // Step 4: Build author cache
  if (!dryRun) {
    await buildAuthorCache(credentials);
  }

  const uploadsDir = getUploadsDir();
  const results: ArticlePublishResult[] = [];

  // Step 5: Publish each article sequentially
  for (let i = 0; i < sortedArticles.length; i++) {
    const article = sortedArticles[i];

    const result = await publishSingleArticle(
      article,
      edition.editionNumber,
      edition.editionDate,
      credentials,
      uploadsDir,
      dryRun,
      onProgress,
      i + 1,
      sortedArticles.length
    );

    results.push(result);

    if (!result.success) {
      errors.push(`Artikel "${result.title}": ${result.error}`);
    }
  }

  // Step 6: Clear caches
  clearAuthorCache();

  // Calculate stats
  const articlesPublished = results.filter((r) => r.success).length;
  const articlesFailed = results.filter((r) => !r.success).length;

  console.log(
    `[WordPress] Publication complete: ${articlesPublished} published, ${articlesFailed} failed`
  );

  return {
    success: articlesFailed === 0,
    editionId,
    articlesPublished,
    articlesSkipped: 0,
    articlesFailed,
    results,
    errors,
    dryRun,
  };
}

/**
 * Publish a single article to WordPress by article ID
 *
 * @param articleId - Database ID of the article to publish
 * @param options - Publishing options (dryRun, progress callback)
 * @returns PublishResult with the single article result
 */
export async function publishArticleToWordPress(
  articleId: number,
  options: PublishOptions = {}
): Promise<PublishResult> {
  const { dryRun = false, onProgress } = options;

  console.log(
    `[WordPress] Starting publication of article ${articleId}${dryRun ? " (dry run)" : ""}`
  );

  // Step 1: Validate credentials
  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    return {
      success: false,
      editionId: 0,
      articlesPublished: 0,
      articlesSkipped: 0,
      articlesFailed: 1,
      results: [],
      errors: [
        "WordPress credentials niet geconfigureerd. Stel WP_USERNAME, WP_APP_PASSWORD en NEXT_PUBLIC_WP_API_URL in.",
      ],
      dryRun,
    };
  }

  if (!dryRun) {
    const validation = await validateWpCredentials(credentials);
    if (!validation.valid) {
      return {
        success: false,
        editionId: 0,
        articlesPublished: 0,
        articlesSkipped: 0,
        articlesFailed: 1,
        results: [],
        errors: [`WordPress authenticatie mislukt: ${validation.error}`],
        dryRun,
      };
    }
    console.log(`[WordPress] Authenticated as: ${validation.user?.name}`);
  }

  // Step 2: Load article data
  const articleData = await loadArticleData(articleId);
  if (!articleData) {
    return {
      success: false,
      editionId: 0,
      articlesPublished: 0,
      articlesSkipped: 0,
      articlesFailed: 1,
      results: [],
      errors: [`Artikel ${articleId} niet gevonden`],
      dryRun,
    };
  }

  const { article, editionNumber, editionDate } = articleData;

  // Step 3: Build author cache
  if (!dryRun) {
    await buildAuthorCache(credentials);
  }

  const uploadsDir = getUploadsDir();

  // Step 4: Publish the article
  const result = await publishSingleArticle(
    article,
    editionNumber,
    editionDate,
    credentials,
    uploadsDir,
    dryRun,
    onProgress,
    1,
    1
  );

  // Step 5: Clear caches
  clearAuthorCache();

  console.log(
    `[WordPress] Publication complete: ${result.success ? "success" : "failed"}`
  );

  return {
    success: result.success,
    editionId: 0,
    articlesPublished: result.success ? 1 : 0,
    articlesSkipped: 0,
    articlesFailed: result.success ? 0 : 1,
    results: [result],
    errors: result.error ? [`Artikel "${result.title}": ${result.error}`] : [],
    dryRun,
  };
}

/**
 * Validate WordPress credentials
 * Convenience re-export with credential loading
 */
export async function validateCredentials(): Promise<{
  valid: boolean;
  error?: string;
  username?: string;
}> {
  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    return {
      valid: false,
      error: "WordPress credentials niet geconfigureerd",
    };
  }

  const result = await validateWpCredentials(credentials);
  return {
    valid: result.valid,
    error: result.error,
    username: result.user?.name,
  };
}
