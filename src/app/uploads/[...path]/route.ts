import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";

// Simple mime type lookup for common image types
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/**
 * Serve files from the uploads directory
 *
 * This route handles requests to /uploads/* and serves files from the
 * uploads directory outside of the public folder.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  // Decode URL-encoded characters in path segments (handles commas, parentheses, etc.)
  const decodedPath = path.map((segment) => decodeURIComponent(segment));
  const filePath = join(process.cwd(), "uploads", ...decodedPath);

  console.log(`[Uploads] Serving file: ${filePath}`);

  try {
    // Check if file exists
    await stat(filePath);

    // Read file
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const filename = decodedPath[decodedPath.length - 1];
    const ext = extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(`[Uploads] File not found: ${filePath}`, error);
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );
  }
}
