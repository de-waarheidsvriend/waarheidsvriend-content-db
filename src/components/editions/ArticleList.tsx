"use client";

import { useEdition } from "@/hooks/useEditions";
import { ArticleCard } from "./ArticleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ArticleSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-12" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ArticleListProps {
  editionId: number;
}

export function ArticleList({ editionId }: ArticleListProps) {
  const { data: edition, isLoading, error } = useEdition(editionId);

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <ArticleSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Fout</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Kon editie niet laden: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!edition || edition.articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geen artikelen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Deze editie bevat nog geen geparsede artikelen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {edition.articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
