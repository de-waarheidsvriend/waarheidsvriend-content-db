import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";
import type {
  EditionDetail,
  EditionStatus,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from "@/types/api";

type EditionDetailResponse = ApiResponse<EditionDetail>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<EditionDetailResponse>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<EditionDetailResponse>;
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
    ) as NextResponse<EditionDetailResponse>;
  }

  try {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        _count: {
          select: { articles: true },
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

    const data: EditionDetail = {
      id: String(edition.id),
      editionNumber: edition.edition_number,
      editionDate: edition.edition_date.toISOString(),
      articleCount: edition._count.articles,
      status: edition.status as EditionStatus,
    };

    return NextResponse.json<SuccessResponse<EditionDetail>>({ success: true, data });
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
