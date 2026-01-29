"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Author with photo for article detail view
 */
export interface ArticleAuthor {
  id: number;
  name: string;
  photoUrl: string | null;
}

/**
 * Image with metadata for article detail view
 */
export interface ArticleImage {
  id: number;
  url: string;
  caption: string | null;
  isFeatured: boolean;
}

/**
 * Full article detail for review interface (FR26)
 */
export interface ArticleDetail {
  id: number;
  title: string;
  chapeau: string | null;
  content: string;
  excerpt: string | null;
  category: string | null;
  authorBio: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  editionId: number;
  editionNumber: number;
  authors: ArticleAuthor[];
  featuredImage: {
    id: number;
    url: string;
    caption: string | null;
  } | null;
  images: ArticleImage[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchArticle(id: number): Promise<ArticleDetail> {
  const response = await fetch(`/api/articles/${id}`);
  const result: ApiResponse<ArticleDetail> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch article");
  }

  return result.data;
}

/**
 * Hook to fetch a single article with full details
 */
export function useArticle(id: number | null) {
  return useQuery({
    queryKey: ["article", id],
    queryFn: () => {
      if (id === null) {
        throw new Error("Article ID is required");
      }
      return fetchArticle(id);
    },
    enabled: id !== null,
  });
}
