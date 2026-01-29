import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditionList } from "@/components/editions/EditionList";

export default function EditionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edities</h1>
        <Link href="/editions/upload">
          <Button>Nieuwe editie uploaden</Button>
        </Link>
      </div>
      <EditionList />
    </div>
  );
}
