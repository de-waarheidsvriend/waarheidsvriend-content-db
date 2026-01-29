import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";
import type {
  ArticleSummary,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from "@/types/api";

type ArticlesResponse = ApiResponse<ArticleSummary[]>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ArticlesResponse>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<ArticlesResponse>;
  }

  const { id } = await params;
  const editionId = parseInt(id, 10);

  if (isNaN(editionId) || editionId < 1) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid edition ID" },
      },
      { status: 400 }
    ) as NextResponse<ArticlesResponse>;
  }

  try {
    // First check if edition exists
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    });

    if (!edition) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: { code: "NOT_FOUND", message: `Edition ${editionId} not found` },
        },
        { status: 404 }
      );
    }

    // Fetch articles for the edition
    const articles = await prisma.article.findMany({
      where: { edition_id: editionId },
      select: {
        id: true,
        title: true,
        chapeau: true,
        category: true,
        page_start: true,
        page_end: true,
      },
      orderBy: { page_start: "asc" },
    });

    const data: ArticleSummary[] = articles.map((article) => ({
      id: String(article.id),
      title: article.title,
      chapeau: article.chapeau,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
    }));

    return NextResponse.json<SuccessResponse<ArticleSummary[]>>({ success: true, data });
  } catch (error) {
    console.error("[API] Error fetching articles:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch articles" },
      },
      { status: 500 }
    );
  }
}
