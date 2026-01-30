"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PublishResult } from "@/services/wordpress/types";

interface PublishOptions {
  dryRun?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function publishEdition(
  editionId: number,
  options: PublishOptions = {}
): Promise<PublishResult> {
  const response = await fetch(`/api/editions/${editionId}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const result: ApiResponse<PublishResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to publish edition");
  }

  return result.data;
}

/**
 * React Query mutation hook for publishing an edition to WordPress
 *
 * @example
 * ```tsx
 * const { mutate, isPending, isSuccess, isError, data, error } = usePublishEdition();
 *
 * // Trigger publish
 * mutate({ editionId: 123 });
 *
 * // Or with dry run
 * mutate({ editionId: 123, dryRun: true });
 * ```
 */
export function usePublishEdition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      editionId,
      dryRun = false,
    }: {
      editionId: number;
      dryRun?: boolean;
    }) => publishEdition(editionId, { dryRun }),
    onSuccess: (_data, variables) => {
      // Invalidate edition query to reflect any status changes
      queryClient.invalidateQueries({ queryKey: ["edition", variables.editionId] });
      queryClient.invalidateQueries({ queryKey: ["editions"] });
    },
  });
}
