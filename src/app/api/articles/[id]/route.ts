import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Article detail with full content for review interface (FR26)
 */
interface ArticleDetailResponse {
  success: true;
  data: {
    id: number;
    title: string;
    chapeau: string | null;
    content: string;
    excerpt: string | null;
    category: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    editionId: number;
    editionNumber: number;
    authors: {
      id: number;
      name: string;
      photoUrl: string | null;
    }[];
    featuredImage: {
      id: number;
      url: string;
      caption: string | null;
    } | null;
    images: {
      id: number;
      url: string;
      caption: string | null;
      isFeatured: boolean;
    }[];
  };
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = ArticleDetailResponse | ErrorResponse;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;
  const articleId = parseInt(id, 10);

  if (isNaN(articleId) || articleId < 1) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid article ID" },
      },
      { status: 400 }
    );
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        edition: {
          select: {
            id: true,
            edition_number: true,
          },
        },
        article_authors: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                photo_url: true,
              },
            },
          },
        },
        images: {
          orderBy: [{ is_featured: "desc" }, { sort_order: "asc" }],
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

    const featuredImage = article.images.find((img) => img.is_featured) || null;

    const data = {
      id: article.id,
      title: article.title,
      chapeau: article.chapeau,
      content: article.content,
      excerpt: article.excerpt,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
      editionId: article.edition.id,
      editionNumber: article.edition.edition_number,
      authors: article.article_authors.map((aa) => ({
        id: aa.author.id,
        name: aa.author.name,
        photoUrl: aa.author.photo_url,
      })),
      featuredImage: featuredImage
        ? {
            id: featuredImage.id,
            url: featuredImage.url,
            caption: featuredImage.caption,
          }
        : null,
      images: article.images.map((img) => ({
        id: img.id,
        url: img.url,
        caption: img.caption,
        isFeatured: img.is_featured,
      })),
    };

    return NextResponse.json<ArticleDetailResponse>({ success: true, data });
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
