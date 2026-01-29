import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface EditionDetailResponse {
  success: true;
  data: {
    id: number;
    editionNumber: number;
    editionDate: string;
    status: string;
    createdAt: string;
    articles: {
      id: number;
      title: string;
      category: string | null;
      pageStart: number | null;
      pageEnd: number | null;
      authors: { id: number; name: string }[];
    }[];
  };
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = EditionDetailResponse | ErrorResponse;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
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
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        articles: {
          orderBy: { page_start: "asc" },
          include: {
            article_authors: {
              include: {
                author: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
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

    const data = {
      id: edition.id,
      editionNumber: edition.edition_number,
      editionDate: edition.edition_date.toISOString(),
      status: edition.status,
      createdAt: edition.created_at.toISOString(),
      articles: edition.articles.map((article) => ({
        id: article.id,
        title: article.title,
        category: article.category,
        pageStart: article.page_start,
        pageEnd: article.page_end,
        authors: article.article_authors.map((aa) => ({
          id: aa.author.id,
          name: aa.author.name,
        })),
      })),
    };

    return NextResponse.json<EditionDetailResponse>({ success: true, data });
  } catch (error) {
    console.error("[API] Error fetching edition:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch edition" },
      },
      { status: 500 }
    );
  }
}
