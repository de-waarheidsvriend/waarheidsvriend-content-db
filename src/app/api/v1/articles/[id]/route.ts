import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";
import {
  transformToContentBlocks,
  getFeaturedImage,
  type ImageData,
} from "@/lib/content-blocks";
import type {
  ArticleDetail,
  AuthorInline,
  FeaturedImage,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from "@/types/api";

type ArticleDetailResponse = ApiResponse<ArticleDetail>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ArticleDetailResponse>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<ArticleDetailResponse>;
  }

  const { id } = await params;
  const articleId = parseInt(id, 10);

  if (isNaN(articleId) || articleId < 1) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid article ID" },
      },
      { status: 400 }
    ) as NextResponse<ArticleDetailResponse>;
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
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
    });

    if (!article) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: { code: "NOT_FOUND", message: `Article ${articleId} not found` },
        },
        { status: 404 }
      );
    }

    // Transform authors to inline format
    const authors: AuthorInline[] = article.article_authors.map((aa) => ({
      id: String(aa.author.id),
      name: aa.author.name,
      photoUrl: aa.author.photo_url,
    }));

    // Transform images to ImageData format
    const imageData: ImageData[] = article.images.map((img) => ({
      url: img.url,
      caption: img.caption,
      isFeatured: img.is_featured,
      sortOrder: img.sort_order,
    }));

    // Get featured image
    const featuredImageData = getFeaturedImage(imageData);
    const featuredImage: FeaturedImage | null = featuredImageData
      ? { url: featuredImageData.url, caption: featuredImageData.caption }
      : null;

    // Transform content to blocks
    const contentBlocks = transformToContentBlocks({
      content: article.content,
      images: imageData,
    });

    const data: ArticleDetail = {
      id: String(article.id),
      title: article.title,
      chapeau: article.chapeau,
      excerpt: article.excerpt,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
      authors,
      featuredImage,
      contentBlocks,
    };

    return NextResponse.json<SuccessResponse<ArticleDetail>>({ success: true, data });
  } catch (error) {
    console.error("[API] Error fetching article:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch article" },
      },
      { status: 500 }
    );
  }
}
