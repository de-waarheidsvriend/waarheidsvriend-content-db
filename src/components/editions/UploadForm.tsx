"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpload } from "@/hooks/useUpload";
import { UploadProgress } from "./UploadProgress";

export function UploadForm() {
  const router = useRouter();
  const { upload, isLoading, error, progress, step } = useUpload();
  const [xhtmlFile, setXhtmlFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!xhtmlFile || !pdfFile) return;

    upload(
      { xhtml: xhtmlFile, pdf: pdfFile },
      {
        onSuccess: (response) => {
          if (response.success && response.data) {
            router.push(`/editions/${response.data.editionId}`);
          }
        },
      }
    );
  };

  const canSubmit = xhtmlFile && pdfFile && !isLoading;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Nieuwe Editie Uploaden</CardTitle>
        <CardDescription>
          Upload de XHTML-export (als ZIP) en de PDF van de editie.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="xhtml">XHTML Export (ZIP)</Label>
            <Input
              id="xhtml"
              type="file"
              accept=".zip"
              onChange={(e) => setXhtmlFile(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf">PDF Bestand</Label>
            <Input
              id="pdf"
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
          </div>

          {isLoading && <UploadProgress progress={progress} step={step} />}

          {error && (
            <p className="text-sm text-destructive">
              Upload mislukt. Probeer het opnieuw.
            </p>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isLoading ? "Uploaden..." : "Upload Editie"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
