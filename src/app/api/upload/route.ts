import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/db";
import { extractMetadata } from "@/services/parser/metadata-extractor";

// Temporary edition number range (negative to avoid collision with real editions)
const TEMP_EDITION_NUMBER_MAX = 2_000_000_000;

interface UploadSuccessResponse {
  success: true;
  data: {
    editionId: number;
    status: string;
    message: string;
  };
}

interface UploadErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR" | "INTERNAL_ERROR";
    message: string;
  };
}

type UploadResponse = UploadSuccessResponse | UploadErrorResponse;

export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse>> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error("[Upload API] FormData parse error:", parseError);
    return NextResponse.json<UploadErrorResponse>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Failed to parse upload: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        },
      },
      { status: 400 }
    );
  }

  try {
    const xhtmlZip = formData.get("xhtml") as File | null;
    const pdf = formData.get("pdf") as File | null;

    // Validate both files are provided
    if (!xhtmlZip || !pdf) {
      return NextResponse.json<UploadErrorResponse>(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Both XHTML zip and PDF are required",
          },
        },
        { status: 400 }
      );
    }

    // Validate file types
    const validZipTypes = [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-zip",
    ];
    const validPdfTypes = ["application/pdf"];

    if (!validZipTypes.includes(xhtmlZip.type) && !xhtmlZip.name.endsWith(".zip")) {
      return NextResponse.json<UploadErrorResponse>(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "XHTML export must be a ZIP file",
          },
        },
        { status: 400 }
      );
    }

    if (!validPdfTypes.includes(pdf.type) && !pdf.name.endsWith(".pdf")) {
      return NextResponse.json<UploadErrorResponse>(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "PDF file must be a valid PDF",
          },
        },
        { status: 400 }
      );
    }

    // Create edition with status "processing"
    // Use negative random number as temporary unique edition_number (will be updated after metadata parsing)
    // Keep within PostgreSQL integer range (-2147483648 to 2147483647)
    const tempEditionNumber = -Math.floor(Math.random() * TEMP_EDITION_NUMBER_MAX);
    const edition = await prisma.edition.create({
      data: {
        edition_number: tempEditionNumber,
        edition_date: new Date(), // Placeholder, will be updated after metadata parsing
        status: "processing",
      },
    });

    const editionDir = join(
      process.cwd(),
      "uploads",
      "editions",
      String(edition.id)
    );
    const xhtmlDir = join(editionDir, "xhtml");
    const pdfDir = join(editionDir, "pdf");

    try {
      // Create directories
      await mkdir(xhtmlDir, { recursive: true });
      await mkdir(pdfDir, { recursive: true });

      // Extract XHTML zip
      const xhtmlBuffer = Buffer.from(await xhtmlZip.arrayBuffer());
      const zip = new AdmZip(xhtmlBuffer);
      zip.extractAllTo(xhtmlDir, true);

      // Save PDF
      const pdfBuffer = Buffer.from(await pdf.arrayBuffer());
      await writeFile(join(pdfDir, "editie.pdf"), pdfBuffer);

      // Extract metadata from XHTML and update edition
      const metadata = await extractMetadata(xhtmlDir);
      if (metadata.editionNumber !== null || metadata.editionDate !== null) {
        await prisma.edition.update({
          where: { id: edition.id },
          data: {
            ...(metadata.editionNumber !== null && {
              edition_number: metadata.editionNumber,
            }),
            ...(metadata.editionDate !== null && {
              edition_date: metadata.editionDate,
            }),
          },
        });
      }

      return NextResponse.json<UploadSuccessResponse>({
        success: true,
        data: {
          editionId: edition.id,
          status: "processing",
          message: "Upload successful, processing started",
        },
      });
    } catch (fileError) {
      // Rollback: Clean up edition record and any created files
      console.error("[Upload API] File processing error, rolling back:", fileError);

      try {
        // Delete edition record
        await prisma.edition.delete({ where: { id: edition.id } });
        // Delete any created files/directories
        await rm(editionDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("[Upload API] Cleanup failed:", cleanupError);
      }

      throw fileError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("[Upload API] Error:", error);
    console.error("[Upload API] Error stack:", error instanceof Error ? error.stack : "No stack");

    // Return more detailed error message in development
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : "Upload failed";

    return NextResponse.json<UploadErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}
