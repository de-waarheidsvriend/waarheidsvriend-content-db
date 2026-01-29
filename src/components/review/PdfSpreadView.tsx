"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageImages, type PageImage } from "@/hooks/usePageImages";

interface PdfSpreadViewProps {
  editionId: number;
  pageStart: number | null;
  pageEnd: number | null;
}

function PdfSpreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-muted rounded-lg">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
      <div className="flex items-center justify-center gap-2 mt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

function SpreadImage({ pageImage, alt }: { pageImage: PageImage; alt: string }) {
  return (
    <div className="relative w-full aspect-[0.707] bg-muted rounded overflow-hidden">
      <Image
        src={pageImage.imageUrl}
        alt={alt}
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}

/**
 * PDF spread viewer component for review interface (FR27)
 * Displays PDF page(s) for an article's page range
 * Allows navigation between spreads when article spans multiple pages
 */
export function PdfSpreadView({ editionId, pageStart, pageEnd }: PdfSpreadViewProps) {
  const { data: pageImages, isLoading, error } = usePageImages(editionId);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

  // Calculate which pages are relevant for this article
  const relevantPages = useMemo(() => {
    if (!pageImages || pageStart === null) return [];

    const start = pageStart;
    const end = pageEnd ?? pageStart;

    return pageImages.filter(
      (img) => img.pageNumber >= start && img.pageNumber <= end
    );
  }, [pageImages, pageStart, pageEnd]);

  // Group pages into spreads (pairs of pages)
  // Page 1 is usually alone (cover), then 2-3, 4-5, etc.
  const spreads = useMemo(() => {
    if (relevantPages.length === 0) return [];

    const result: PageImage[][] = [];
    let i = 0;

    while (i < relevantPages.length) {
      const page = relevantPages[i];
      // Single page spread for odd pages or if it's the last page
      if (page.pageNumber % 2 === 1 || i === relevantPages.length - 1) {
        result.push([page]);
        i++;
      } else {
        // Even page - look for the next odd page to pair with
        const nextPage = relevantPages[i + 1];
        if (nextPage && nextPage.pageNumber === page.pageNumber + 1) {
          result.push([page, nextPage]);
          i += 2;
        } else {
          result.push([page]);
          i++;
        }
      }
    }

    return result;
  }, [relevantPages]);

  const currentSpread = spreads[currentSpreadIndex];
  const hasMultipleSpreads = spreads.length > 1;
  const canGoPrev = currentSpreadIndex > 0;
  const canGoNext = currentSpreadIndex < spreads.length - 1;

  if (isLoading) {
    return <PdfSpreadSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Kon PDF-pagina&apos;s niet laden: {error.message}</p>
      </div>
    );
  }

  if (!pageImages || pageImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Geen PDF-pagina&apos;s beschikbaar voor deze editie</p>
      </div>
    );
  }

  if (pageStart === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Geen paginanummers bekend voor dit artikel</p>
      </div>
    );
  }

  if (relevantPages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Geen PDF-pagina&apos;s gevonden voor pagina {pageStart}{pageEnd && pageEnd !== pageStart ? `-${pageEnd}` : ""}</p>
      </div>
    );
  }

  // Calculate page range string for current spread
  const getSpreadLabel = (spread: PageImage[]) => {
    if (spread.length === 1) {
      return `p. ${spread[0].pageNumber}`;
    }
    return `p. ${spread[0].pageNumber}-${spread[1].pageNumber}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Spread display */}
      <div className="flex-1 flex items-center justify-center gap-1 min-h-0">
        {currentSpread && currentSpread.length === 2 ? (
          // Two-page spread
          <div className="flex gap-1 h-full max-h-full">
            <div className="flex-1 max-w-[50%]">
              <SpreadImage
                pageImage={currentSpread[0]}
                alt={`Pagina ${currentSpread[0].pageNumber}`}
              />
            </div>
            <div className="flex-1 max-w-[50%]">
              <SpreadImage
                pageImage={currentSpread[1]}
                alt={`Pagina ${currentSpread[1].pageNumber}`}
              />
            </div>
          </div>
        ) : currentSpread ? (
          // Single page
          <div className="h-full max-w-full flex items-center justify-center">
            <SpreadImage
              pageImage={currentSpread[0]}
              alt={`Pagina ${currentSpread[0].pageNumber}`}
            />
          </div>
        ) : null}
      </div>

      {/* Navigation controls */}
      {hasMultipleSpreads && (
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSpreadIndex((i) => i - 1)}
            disabled={!canGoPrev}
          >
            &larr; Vorige
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentSpread && getSpreadLabel(currentSpread)} ({currentSpreadIndex + 1}/{spreads.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSpreadIndex((i) => i + 1)}
            disabled={!canGoNext}
          >
            Volgende &rarr;
          </Button>
        </div>
      )}

      {/* Page indicator for single spread */}
      {!hasMultipleSpreads && currentSpread && (
        <div className="flex items-center justify-center mt-4 pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {getSpreadLabel(currentSpread)}
          </span>
        </div>
      )}
    </div>
  );
}
