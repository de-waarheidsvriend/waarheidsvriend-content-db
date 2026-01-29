"use client";

import { PdfSpreadView } from "./PdfSpreadView";
import { ArticleView } from "./ArticleView";
import { Skeleton } from "@/components/ui/skeleton";

interface SplitViewProps {
  editionId: number;
  articleId: number;
  pageStart: number | null;
  pageEnd: number | null;
}

function SplitViewSkeleton() {
  return (
    <div className="flex h-full gap-4">
      <div className="w-1/2 p-4 border-r bg-muted/20">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
      <div className="w-1/2 p-4 overflow-y-auto">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-64 w-full rounded-lg mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

/**
 * Split view component for review interface (FR27)
 * Left: PDF spread(s) for the article's pages
 * Right: Parsed article content
 */
export function SplitView({ editionId, articleId, pageStart, pageEnd }: SplitViewProps) {
  return (
    <div className="flex h-full">
      {/* Left panel: PDF spread */}
      <div className="w-1/2 p-4 border-r bg-muted/10 flex flex-col min-h-0">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Originele PDF
        </h2>
        <div className="flex-1 min-h-0">
          <PdfSpreadView
            editionId={editionId}
            pageStart={pageStart}
            pageEnd={pageEnd}
          />
        </div>
      </div>

      {/* Right panel: Parsed content */}
      <div className="w-1/2 p-4 overflow-y-auto">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Geparsede content
        </h2>
        <ArticleView articleId={articleId} />
      </div>
    </div>
  );
}

export { SplitViewSkeleton };
