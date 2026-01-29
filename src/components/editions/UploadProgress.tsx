"use client";

interface UploadProgressProps {
  progress: number;
  step?: "uploading" | "processing" | "parsing" | "completed";
}

const STEPS = [
  { key: "uploading", label: "Uploaden..." },
  { key: "processing", label: "PDF verwerken..." },
  { key: "parsing", label: "Content parsen..." },
  { key: "completed", label: "Voltooid" },
] as const;

export function UploadProgress({
  progress,
  step = "uploading",
}: UploadProgressProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {STEPS.map((s, index) => (
          <span
            key={s.key}
            className={
              index <= currentStepIndex
                ? "font-medium text-primary"
                : "text-muted-foreground"
            }
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
