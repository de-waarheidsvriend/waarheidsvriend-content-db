/**
 * API Endpoint: Publish Edition to WordPress
 *
 * POST /api/editions/[id]/publish
 *
 * Triggers publication of all articles in an edition to WordPress.
 * Requires authenticated session (not API key - this is a UI action).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishEditionToWordPress, type PublishResult } from "@/services/wordpress";

interface PublishRequestBody {
  dryRun?: boolean;
}

interface SuccessResponse {
  success: true;
  data: PublishResult;
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse = SuccessResponse | ErrorResponse;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  // Check authentication (session-based, not API key)
  const session = await auth();
  if (!session) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      },
      { status: 401 }
    );
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

  // Parse request body
  let body: PublishRequestBody = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is fine
  }

  const dryRun = body.dryRun ?? false;

  try {
    // Verify edition exists and check status
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        status: true,
        edition_number: true,
        _count: { select: { articles: true } },
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

    // Check if edition has completed processing
    if (edition.status !== "completed" && edition.status !== "completed_with_errors") {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Edition ${editionId} has status "${edition.status}". Only completed editions can be published.`,
          },
        },
        { status: 400 }
      );
    }

    // Check if there are articles to publish
    if (edition._count.articles === 0) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: {
            code: "NO_ARTICLES",
            message: `Edition ${editionId} has no articles to publish.`,
          },
        },
        { status: 400 }
      );
    }

    console.log(
      `[API] Publishing edition ${editionId} (${edition._count.articles} articles)${dryRun ? " [dry run]" : ""}`
    );

    // Publish to WordPress
    const result = await publishEditionToWordPress(editionId, { dryRun });

    if (!result.success) {
      // Return partial success with errors
      return NextResponse.json<SuccessResponse>(
        { success: true, data: result },
        { status: 207 } // 207 Multi-Status for partial success
      );
    }

    return NextResponse.json<SuccessResponse>({ success: true, data: result });
  } catch (error) {
    console.error("[API] Error publishing edition:", error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to publish edition",
        },
      },
      { status: 500 }
    );
  }
}
