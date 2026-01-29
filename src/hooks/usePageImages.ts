"use client";

import { useQuery } from "@tanstack/react-query";

export interface PageImage {
  id: number;
  pageNumber: number;
  imageUrl: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchPageImages(editionId: number): Promise<PageImage[]> {
  const response = await fetch(`/api/editions/${editionId}/page-images`);
  const result: ApiResponse<PageImage[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch page images");
  }

  return result.data;
}

/**
 * Hook to fetch page images for an edition
 */
export function usePageImages(editionId: number | null) {
  return useQuery({
    queryKey: ["pageImages", editionId],
    queryFn: () => {
      if (editionId === null) {
        throw new Error("Edition ID is required");
      }
      return fetchPageImages(editionId);
    },
    enabled: editionId !== null,
  });
}
