/**
 * WordPress Publishing Service
 *
 * Main orchestration module for publishing editions to WordPress.
 * Coordinates all sub-services: API client, article mapper, media uploader, author sync.
 */

import type { PrismaClient } from "@prisma/client";
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
} from "./article-mapper";

import {
  uploadFeaturedImage,
  getUploadsDir,
} from "./media-uploader";

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
      chapeau: article.chapeau,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
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
    // Step 1: Sync author(s)
    reportProgress("syncing_author");
    let wpAuthorId: number | undefined;

    if (article.authors.length > 0) {
      const primaryAuthor = article.authors[0];
      if (!dryRun) {
        const authorId = await findOrCreateWpUser(primaryAuthor.name, credentials);
        if (authorId) {
          wpAuthorId = authorId;
        }
        await sleep(API_DELAY_MS);
      } else {
        console.log(`[DryRun] Would sync author: ${primaryAuthor.name}`);
      }
    }

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

    // Step 3: Map article to WP payload
    reportProgress("publishing");
    const payload = mapArticleToWpPayload(
      article,
      editionNumber,
      wpAuthorId,
      wpImageId
    );

    if (dryRun) {
      console.log(`[DryRun] Would publish article: ${article.title}`);
      console.log(`[DryRun]   Slug: ${payload.slug}`);
      console.log(`[DryRun]   Components: ${payload.acf.components.length}`);
      console.log(`[DryRun]   Author ID: ${wpAuthorId || "none"}`);
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
