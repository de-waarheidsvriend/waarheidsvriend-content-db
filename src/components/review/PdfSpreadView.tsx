"use client";

import { useState, useMemo, useEffect } from "react";
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
      {/* Use img tag for dynamic uploads path - Next.js Image requires hostname config */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pageImage.imageUrl}
        alt={alt}
        className="w-full h-full object-contain"
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

  // Reset spread index when article changes (pageStart/pageEnd change)
  useEffect(() => {
    setCurrentSpreadIndex(0);
  }, [pageStart, pageEnd]);

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
  // Magazine spreads: page 1 alone (cover), then 2-3, 4-5, etc.
  // In a spread, even page is left, odd page is right (e.g., p2 left, p3 right)
  const spreads = useMemo(() => {
    if (relevantPages.length === 0) return [];

    const result: PageImage[][] = [];
    let i = 0;

    while (i < relevantPages.length) {
      const page = relevantPages[i];
      const pageNum = page.pageNumber;

      // Page 1 (cover) is always alone
      if (pageNum === 1) {
        result.push([page]);
        i++;
        continue;
      }

      // Even pages start a spread (left side)
      // Odd pages > 1 complete a spread (right side) or stand alone
      if (pageNum % 2 === 0) {
        // Even page - look for the next odd page to form a spread
        const nextPage = relevantPages[i + 1];
        if (nextPage && nextPage.pageNumber === pageNum + 1) {
          // Found matching odd page, create spread
          result.push([page, nextPage]);
          i += 2;
        } else {
          // No matching page, show alone
          result.push([page]);
          i++;
        }
      } else {
        // Odd page > 1 without its even partner - show alone
        result.push([page]);
        i++;
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
        <nav className="flex items-center justify-center gap-4 mt-4 pt-4 border-t" aria-label="PDF spread navigatie">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSpreadIndex((i) => i - 1)}
            disabled={!canGoPrev}
            aria-label="Ga naar vorige spread"
          >
            &larr; Vorige
          </Button>
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {currentSpread && getSpreadLabel(currentSpread)} ({currentSpreadIndex + 1}/{spreads.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSpreadIndex((i) => i + 1)}
            disabled={!canGoNext}
            aria-label="Ga naar volgende spread"
          >
            Volgende &rarr;
          </Button>
        </nav>
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
