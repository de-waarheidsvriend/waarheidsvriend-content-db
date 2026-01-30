"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePublishEdition } from "@/hooks/usePublish";

interface PublishButtonProps {
  editionId: number;
  articleCount: number;
  disabled?: boolean;
}

export function PublishButton({
  editionId,
  articleCount,
  disabled = false,
}: PublishButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate, isPending, isSuccess, isError, data, error, reset } =
    usePublishEdition();

  const handleClick = () => {
    if (isSuccess || isError) {
      // Reset state to allow retry
      reset();
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    mutate({ editionId, dryRun: false });
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  // Confirmation dialog
  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {articleCount} {articleCount === 1 ? "artikel" : "artikelen"} publiceren?
        </span>
        <Button size="sm" onClick={handleConfirm}>
          Ja, publiceer
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          Annuleer
        </Button>
      </div>
    );
  }

  // Loading state
  if (isPending) {
    return (
      <Button disabled className="min-w-[200px]">
        <LoadingSpinner />
        Publiceren...
      </Button>
    );
  }

  // Success state
  if (isSuccess && data) {
    const published = data.articlesPublished;
    const failed = data.articlesFailed;

    if (failed > 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            {published} gepubliceerd, {failed} mislukt
          </span>
          <Button size="sm" variant="outline" onClick={handleClick}>
            Opnieuw proberen
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <SuccessIcon />
        <span className="text-sm text-green-600 dark:text-green-400">
          Gepubliceerd! ({published} {published === 1 ? "artikel" : "artikelen"})
        </span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <ErrorIcon />
        <span className="text-sm text-destructive truncate max-w-[200px]" title={error?.message}>
          {error?.message || "Publicatie mislukt"}
        </span>
        <Button size="sm" variant="outline" onClick={handleClick}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  // Default state
  return (
    <Button onClick={handleClick} disabled={disabled || articleCount === 0}>
      Publiceer naar WordPress
    </Button>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      className="h-5 w-5 text-green-600 dark:text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="h-5 w-5 text-destructive"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
