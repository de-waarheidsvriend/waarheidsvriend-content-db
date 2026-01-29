import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";
import type {
  EditionSummary,
  EditionStatus,
  ErrorResponse,
  PaginatedSuccessResponse,
  PaginatedApiResponse,
} from "@/types/api";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  request: NextRequest
): Promise<NextResponse<PaginatedApiResponse<EditionSummary>>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<PaginatedApiResponse<EditionSummary>>;
  }

  try {
    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await prisma.edition.count();
    const totalPages = Math.ceil(total / limit);

    const editions = await prisma.edition.findMany({
      orderBy: { edition_date: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    const data: EditionSummary[] = editions.map((edition) => ({
      id: String(edition.id),
      editionNumber: edition.edition_number,
      editionDate: edition.edition_date.toISOString(),
      articleCount: edition._count.articles,
      status: edition.status as EditionStatus,
    }));

    return NextResponse.json<PaginatedSuccessResponse<EditionSummary>>({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching editions:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch editions" },
      },
      { status: 500 }
    );
  }
}
