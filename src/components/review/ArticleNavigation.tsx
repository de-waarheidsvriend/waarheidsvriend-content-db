"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ArticleNavigationProps {
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  articleTitle?: string;
}

/**
 * Article navigation component with keyboard shortcuts (FR28)
 * Provides prev/next buttons and keyboard navigation (← →)
 */
export function ArticleNavigation({
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  articleTitle,
}: ArticleNavigationProps) {
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < totalCount - 1;

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    },
    [hasPrevious, hasNext, onPrevious, onNext]
  );

  // Register keyboard event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-background border-b">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious}
        title="Vorig artikel (←)"
        aria-label="Ga naar vorig artikel (sneltoets: pijltje links)"
      >
        &larr; Vorige
      </Button>

      <div className="flex-1 text-center min-w-0" role="status" aria-live="polite">
        <div className="text-sm text-muted-foreground">
          Artikel {currentIndex + 1} van {totalCount}
        </div>
        {articleTitle && (
          <div className="text-sm font-medium truncate" title={articleTitle}>
            {articleTitle}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!hasNext}
        title="Volgend artikel (→)"
        aria-label="Ga naar volgend artikel (sneltoets: pijltje rechts)"
      >
        Volgende &rarr;
      </Button>
    </div>
  );
}
