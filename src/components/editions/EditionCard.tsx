"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EditionSummary } from "@/hooks/useEditions";

interface EditionCardProps {
  edition: EditionSummary;
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

export function EditionCard({ edition }: EditionCardProps) {
  const statusBadge = getStatusBadge(edition.status);

  return (
    <Link href={`/editions/${edition.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">
                Editie {edition.editionNumber}
              </CardTitle>
              <CardDescription>{formatDate(edition.editionDate)}</CardDescription>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {edition.articleCount}{" "}
              {edition.articleCount === 1 ? "artikel" : "artikelen"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
