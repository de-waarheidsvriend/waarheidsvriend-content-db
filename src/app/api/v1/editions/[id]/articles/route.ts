import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";

interface ArticleSummary {
  id: number;
  title: string;
  chapeau: string | null;
  category: string | null;
  pageStart: number | null;
  pageEnd: number | null;
}

interface SuccessResponse {
  success: true;
  data: ArticleSummary[];
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = SuccessResponse | ErrorResponse;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<ApiResponse>;
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
    );
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
      id: article.id,
      title: article.title,
      chapeau: article.chapeau,
      category: article.category,
      pageStart: article.page_start,
      pageEnd: article.page_end,
    }));

    return NextResponse.json<SuccessResponse>({ success: true, data });
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
