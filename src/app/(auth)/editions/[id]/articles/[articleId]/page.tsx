"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArticleView } from "@/components/review/ArticleView";

interface ArticleDetailPageProps {
  params: Promise<{ id: string; articleId: string }>;
}

export default function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id, articleId } = use(params);
  const editionId = parseInt(id, 10);
  const parsedArticleId = parseInt(articleId, 10);

  if (isNaN(editionId) || isNaN(parsedArticleId)) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">Ongeldige ID</p>
        <Link href="/editions">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/editions/${editionId}`}>
          <Button variant="outline" size="sm">
            &larr; Terug naar editie
          </Button>
        </Link>
      </div>
      <ArticleView articleId={parsedArticleId} />
    </div>
  );
}
