import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const editions = await prisma.edition.findMany({
      orderBy: { edition_number: "desc" },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    const data = editions.map((edition) => ({
      id: edition.id,
      editionNumber: edition.edition_number,
      editionDate: edition.edition_date.toISOString(),
      status: edition.status,
      articleCount: edition._count.articles,
      createdAt: edition.created_at.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[API] Error fetching editions:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch editions" },
      },
      { status: 500 }
    );
  }
}
