"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import type { UploadStep } from "@/types";

// Re-export the type for convenience
export type { UploadStep } from "@/types";

interface UploadResponse {
  success: boolean;
  data?: { editionId: number; status: string; message: string };
  error?: { code: string; message: string };
}

interface UploadFiles {
  xhtml: File;
  pdf: File;
}

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<UploadStep>("uploading");

  const mutation = useMutation({
    mutationFn: async (files: UploadFiles): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append("xhtml", files.xhtml);
      formData.append("pdf", files.pdf);

      // Reset state at start
      setProgress(0);
      setStep("uploading");

      // Use XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            );
            setProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              // Transition through steps after upload completes
              setStep("processing");
              setTimeout(() => {
                setStep("parsing");
                setTimeout(() => {
                  setStep("completed");
                  setProgress(100);
                  resolve(response);
                }, 500);
              }, 500);
            } catch {
              reject(new Error("Invalid response from server"));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(
                new Error(errorResponse.error?.message || "Upload failed")
              );
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
  });

  const reset = useCallback(() => {
    mutation.reset();
    setProgress(0);
    setStep("uploading");
  }, [mutation]);

  return {
    upload: mutation.mutate,
    uploadAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    progress,
    step,
    reset,
  };
}
