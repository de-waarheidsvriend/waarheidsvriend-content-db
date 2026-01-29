"use client";

import Link from "next/link";
import { useEditions } from "@/hooks/useEditions";
import { EditionCard } from "./EditionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function EditionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}

export function EditionList() {
  const { data: editions, isLoading, error } = useEditions();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <EditionSkeleton key={i} />
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
            Kon edities niet laden: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!editions || editions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geen edities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Er zijn nog geen edities verwerkt. Ga naar{" "}
            <Link href="/editions/upload" className="text-primary hover:underline">
              Upload
            </Link>{" "}
            om een nieuwe editie te uploaden.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {editions.map((edition) => (
        <EditionCard key={edition.id} edition={edition} />
      ))}
    </div>
  );
}
