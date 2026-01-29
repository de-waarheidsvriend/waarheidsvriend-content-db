import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-key";

interface EditionSummary {
  id: number;
  editionNumber: number;
  editionDate: string;
  articleCount: number;
  status: string;
}

interface SuccessResponse {
  success: true;
  data: EditionSummary[];
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = SuccessResponse | ErrorResponse;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  // API Key validation
  if (!validateApiKey(request)) {
    return unauthorizedResponse() as NextResponse<ApiResponse>;
  }

  try {
    const editions = await prisma.edition.findMany({
      orderBy: { edition_date: "desc" },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    const data: EditionSummary[] = editions.map((edition) => ({
      id: edition.id,
      editionNumber: edition.edition_number,
      editionDate: edition.edition_date.toISOString(),
      articleCount: edition._count.articles,
      status: edition.status,
    }));

    return NextResponse.json<SuccessResponse>({ success: true, data });
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
