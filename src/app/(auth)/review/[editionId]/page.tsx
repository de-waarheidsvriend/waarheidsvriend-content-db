"use client";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitView } from "@/components/review/SplitView";
import { ArticleNavigation } from "@/components/review/ArticleNavigation";
import { useEdition, type ArticleSummary } from "@/hooks/useEditions";

interface ReviewPageProps {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ article?: string }>;
}

function ReviewPageSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex-1 flex">
        <div className="w-1/2 p-4 border-r">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="w-1/2 p-4">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

function ReviewContent({
  editionId,
  articles,
  initialArticleId,
}: {
  editionId: number;
  articles: ArticleSummary[];
  initialArticleId?: number;
}) {
  // Find initial index based on article ID from URL or default to 0
  const initialIndex = useMemo(() => {
    if (initialArticleId) {
      const index = articles.findIndex((a) => a.id === initialArticleId);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [articles, initialArticleId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentArticle = articles[currentIndex];

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(articles.length - 1, i + 1));
  }, [articles.length]);

  if (!currentArticle) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Geen artikelen gevonden</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ArticleNavigation
        currentIndex={currentIndex}
        totalCount={articles.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        articleTitle={currentArticle.title}
      />
      <div className="flex-1 min-h-0">
        <SplitView
          editionId={editionId}
          articleId={currentArticle.id}
          pageStart={currentArticle.pageStart}
          pageEnd={currentArticle.pageEnd}
        />
      </div>
    </div>
  );
}

export default function ReviewPage({ params, searchParams }: ReviewPageProps) {
  const { editionId } = use(params);
  const { article: articleIdParam } = use(searchParams);

  const parsedEditionId = parseInt(editionId, 10);
  const initialArticleId = articleIdParam ? parseInt(articleIdParam, 10) : undefined;

  const { data: edition, isLoading, error } = useEdition(
    isNaN(parsedEditionId) ? null : parsedEditionId
  );

  if (isNaN(parsedEditionId)) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive">Ongeldige editie ID</p>
        <Link href="/editions">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <ReviewPageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive">Kon editie niet laden: {error.message}</p>
        <Link href="/editions">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  if (!edition) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-muted-foreground">Editie niet gevonden</p>
        <Link href="/editions">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with back link */}
      <div className="flex items-center gap-4 p-4 border-b bg-background">
        <Link href={`/editions/${parsedEditionId}`}>
          <Button variant="outline" size="sm">
            &larr; Terug naar editie
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">
          Review: Editie {edition.editionNumber}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ReviewContent
          editionId={parsedEditionId}
          articles={edition.articles}
          initialArticleId={initialArticleId}
        />
      </div>
    </div>
  );
}
