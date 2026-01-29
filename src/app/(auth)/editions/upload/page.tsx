import { UploadForm } from "@/components/editions/UploadForm";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Nieuwe Editie Uploaden</h1>
      <UploadForm />
    </div>
  );
}
