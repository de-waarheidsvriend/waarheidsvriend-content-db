"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Edition with article count for list view
 */
export interface EditionSummary {
  id: number;
  editionNumber: number;
  editionDate: string;
  status: string;
  articleCount: number;
  createdAt: string;
}

/**
 * Article summary for edition detail view
 */
export interface ArticleSummary {
  id: number;
  title: string;
  category: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  authors: { id: number; name: string }[];
}

/**
 * Edition detail with full article list
 */
export interface EditionDetail {
  id: number;
  editionNumber: number;
  editionDate: string;
  status: string;
  createdAt: string;
  articles: ArticleSummary[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchEditions(): Promise<EditionSummary[]> {
  const response = await fetch("/api/editions");
  const result: ApiResponse<EditionSummary[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch editions");
  }

  return result.data;
}

async function fetchEdition(id: number): Promise<EditionDetail> {
  const response = await fetch(`/api/editions/${id}`);
  const result: ApiResponse<EditionDetail> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch edition");
  }

  return result.data;
}

/**
 * Hook to fetch all editions
 */
export function useEditions() {
  return useQuery({
    queryKey: ["editions"],
    queryFn: fetchEditions,
  });
}

/**
 * Hook to fetch a single edition with its articles
 */
export function useEdition(id: number | null) {
  return useQuery({
    queryKey: ["edition", id],
    queryFn: () => fetchEdition(id!),
    enabled: id !== null,
  });
}
