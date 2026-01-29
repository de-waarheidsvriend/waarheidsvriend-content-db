import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PageImage {
  id: number;
  pageNumber: number;
  imageUrl: string;
}

interface PageImagesResponse {
  success: true;
  data: PageImage[];
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = PageImagesResponse | ErrorResponse;

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
    // Check if edition exists
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

    // Fetch page images ordered by page number
    const pageImages = await prisma.pageImage.findMany({
      where: { edition_id: editionId },
      orderBy: { page_number: "asc" },
    });

    const data: PageImage[] = pageImages.map((img) => ({
      id: img.id,
      pageNumber: img.page_number,
      imageUrl: `/uploads/${img.image_url}`,
    }));

    return NextResponse.json<PageImagesResponse>({ success: true, data });
  } catch (error) {
    console.error("[API] Error fetching page images:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch page images" },
      },
      { status: 500 }
    );
  }
}
