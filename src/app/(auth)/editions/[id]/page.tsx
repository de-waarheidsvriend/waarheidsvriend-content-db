"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleList } from "@/components/editions/ArticleList";
import { useEdition } from "@/hooks/useEditions";

interface EditionDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "completed":
      return {
        label: "Voltooid",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      };
    case "completed_with_errors":
      return {
        label: "Voltooid (met fouten)",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      };
    case "processing":
      return {
        label: "Verwerken...",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      };
    case "pending":
      return {
        label: "Wachtend",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      };
    case "failed":
      return {
        label: "Mislukt",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      };
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      };
  }
}

function EditionHeader({ editionId }: { editionId: number }) {
  const { data: edition, isLoading } = useEdition(editionId);

  if (isLoading || !edition) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  const statusBadge = getStatusBadge(edition.status);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Editie {edition.editionNumber}</h1>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>
      <p className="text-muted-foreground">
        {formatDate(edition.editionDate)} · {edition.articles.length}{" "}
        {edition.articles.length === 1 ? "artikel" : "artikelen"}
      </p>
    </div>
  );
}

export default function EditionDetailPage({ params }: EditionDetailPageProps) {
  const { id } = use(params);
  const editionId = parseInt(id, 10);

  if (isNaN(editionId)) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">Ongeldige editie ID</p>
        <Link href="/editions">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <EditionHeader editionId={editionId} />
        <div className="flex gap-2">
          <Link href={`/review/${editionId}`}>
            <Button>Review starten</Button>
          </Link>
          <Link href="/editions">
            <Button variant="outline">Terug naar overzicht</Button>
          </Link>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Artikelen</h2>
        <ArticleList editionId={editionId} />
      </div>
    </div>
  );
}
