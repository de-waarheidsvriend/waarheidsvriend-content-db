"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArticleSummary } from "@/hooks/useEditions";

interface ArticleCardProps {
  article: ArticleSummary;
  editionId: number;
}

export function ArticleCard({ article, editionId }: ArticleCardProps) {
  const pageRange =
    article.pageStart && article.pageEnd
      ? article.pageStart === article.pageEnd
        ? `p. ${article.pageStart}`
        : `p. ${article.pageStart}-${article.pageEnd}`
      : null;

  const authorNames = article.authors.map((a) => a.name).join(", ");

  return (
    <Link href={`/editions/${editionId}/articles/${article.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base font-medium leading-tight">
              {article.title}
            </CardTitle>
            {pageRange && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {pageRange}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {authorNames && <span>{authorNames}</span>}
            {authorNames && article.category && <span>·</span>}
            {article.category && (
              <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                {article.category}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
