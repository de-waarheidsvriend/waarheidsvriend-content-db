import { NextRequest, NextResponse } from "next/server";
import { getEditionProcessingStatus } from "@/services/parser";

interface StatusSuccessResponse {
  success: true;
  data: {
    editionId: number;
    status: string;
    articleCount: number;
    imageCount: number;
  };
}

interface StatusErrorResponse {
  success: false;
  error: {
    code: "NOT_FOUND" | "VALIDATION_ERROR";
    message: string;
  };
}

type StatusResponse = StatusSuccessResponse | StatusErrorResponse;

/**
 * GET /api/editions/[id]/status
 *
 * Get the processing status for an edition (FR4)
 * Returns current status and counts of processed items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<StatusResponse>> {
  const { id } = await params;
  const editionId = parseInt(id, 10);

  if (isNaN(editionId) || editionId < 1) {
    return NextResponse.json<StatusErrorResponse>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid edition ID",
        },
      },
      { status: 400 }
    );
  }

  const status = await getEditionProcessingStatus(editionId);

  if (!status) {
    return NextResponse.json<StatusErrorResponse>(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Edition ${editionId} not found`,
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json<StatusSuccessResponse>({
    success: true,
    data: {
      editionId,
      status: status.status,
      articleCount: status.articleCount,
      imageCount: status.imageCount,
    },
  });
}
