# Story 2.1: Upload Interface

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Als Joost,
Wil ik een XHTML-exportmap en PDF kunnen uploaden,
Zodat ik een nieuwe editie kan laten verwerken.

## Acceptance Criteria

1. **Given** ik ben ingelogd
   **When** ik naar `/editions/upload` navigeer
   **Then** zie ik een upload formulier met:
   - Veld voor XHTML-exportmap (folder/zip upload)
   - Veld voor PDF bestand
   - Upload knop

2. **Given** ik heb bestanden geselecteerd
   **When** ik op upload klik
   **Then** worden de bestanden geüpload naar `uploads/editions/[edition-id]/`
   **And** wordt de XHTML-map opgeslagen in `xhtml/` subfolder
   **And** wordt de PDF opgeslagen in `pdf/` subfolder
   **And** zie ik een voortgangsindicator tijdens upload

3. **Given** de upload is voltooid
   **When** de verwerking start
   **Then** worden editienummer en editiedatum geëxtraheerd uit de XHTML
   **And** wordt een nieuwe editie record aangemaakt met deze metadata
   **And** zie ik de verwerkingsstatus (FR4):
   - "Uploaden..." → "PDF verwerken..." → "Content parsen..." → "Voltooid"

4. **And** is er een `src/app/api/upload/route.ts` voor file handling
5. **And** is er een `src/components/editions/UploadForm.tsx` component
6. **And** is er een `src/hooks/useUpload.ts` hook met React Query

## Tasks / Subtasks

- [x] Task 1: Upload API endpoint maken (AC: #4)
  - [x] 1.1 Maak directory `src/app/api/upload/`
  - [x] 1.2 Maak `src/app/api/upload/route.ts` met POST handler
  - [x] 1.3 Implementeer multipart form-data parsing voor bestanden
  - [x] 1.4 Genereer uniek edition-id (gebruik timestamp of uuid)
  - [x] 1.5 Maak directory structuur: `uploads/editions/[edition-id]/xhtml/` en `/pdf/`
  - [x] 1.6 Schrijf XHTML bestanden (zip extraheren) naar `xhtml/` folder
  - [x] 1.7 Schrijf PDF naar `pdf/` folder
  - [x] 1.8 Creëer Edition record in database met status "processing"
  - [x] 1.9 Return edition-id en upload status in response

- [x] Task 2: XHTML metadata extractie (AC: #3)
  - [x] 2.1 Maak `src/services/parser/metadata-extractor.ts`
  - [x] 2.2 Parseer HTML bestanden om editienummer te vinden
  - [x] 2.3 Parseer HTML bestanden om editiedatum te vinden
  - [x] 2.4 Update Edition record met geëxtraheerde metadata
  - [x] 2.5 Voeg error handling toe voor ontbrekende metadata

- [x] Task 3: UploadForm component maken (AC: #1, #5)
  - [x] 3.1 Maak directory `src/components/editions/`
  - [x] 3.2 Maak `src/components/editions/UploadForm.tsx`
  - [x] 3.3 Voeg file input toe voor XHTML-exportmap (accepteer .zip)
  - [x] 3.4 Voeg file input toe voor PDF bestand (accepteer .pdf)
  - [x] 3.5 Voeg submit button toe met disabled state tijdens upload
  - [x] 3.6 Style component met Tailwind en shadcn/ui Card, Button, Input
  - [x] 3.7 Valideer dat beide bestanden geselecteerd zijn voor submit

- [x] Task 4: useUpload hook maken (AC: #2, #6)
  - [x] 4.1 Maak directory `src/hooks/` indien niet bestaat
  - [x] 4.2 Maak `src/hooks/useUpload.ts`
  - [x] 4.3 Gebruik React Query `useMutation` voor upload
  - [x] 4.4 Implementeer FormData constructie met bestanden
  - [x] 4.5 Track upload progress via XMLHttpRequest of fetch
  - [x] 4.6 Return mutation state: isLoading, error, data, progress

- [x] Task 5: Voortgangsindicator implementeren (AC: #2, #3)
  - [x] 5.1 Maak `src/components/editions/UploadProgress.tsx`
  - [x] 5.2 Toon stappen: "Uploaden...", "PDF verwerken...", "Content parsen...", "Voltooid"
  - [x] 5.3 Highlight huidige stap met styling
  - [x] 5.4 Toon progressbar voor upload percentage
  - [x] 5.5 Integreer met UploadForm component

- [x] Task 6: Upload pagina maken (AC: #1)
  - [x] 6.1 Maak `src/app/(auth)/editions/upload/page.tsx`
  - [x] 6.2 Render UploadForm component
  - [x] 6.3 Voeg navigatie link toe in Header naar upload pagina
  - [x] 6.4 Redirect naar editie detail na succesvolle upload

- [x] Task 7: Tests schrijven
  - [x] 7.1 Unit tests voor upload API route
  - [x] 7.2 Unit tests voor metadata-extractor
  - [x] 7.3 Component tests voor UploadForm
  - [x] 7.4 Hook tests voor useUpload

## Dev Notes

### Architecture Compliance

Dit is de eerste story van Epic 2 (Editie Upload & Content Extractie). De upload interface legt de basis voor de hele verwerkingspipeline.

**Architectuur uit architecture.md:**
- File storage: Lokaal filesystem (Docker volume `uploads/`)
- API style: REST met consistente JSON responses
- Frontend: shadcn/ui componenten, React Query voor server state
- Error handling: Gestructureerde error codes

### Upload Directory Structuur

Per editie wordt de volgende structuur aangemaakt:

```
uploads/
└── editions/
    └── [edition-id]/
        ├── xhtml/                    # Geëxtraheerde XHTML-export
        │   ├── index.html
        │   └── publication-web-resources/
        │       ├── css/
        │       ├── html/
        │       └── image/
        └── pdf/
            └── editie.pdf            # Originele PDF
```

### XHTML Export Formaat (Input)

De InDesign XHTML-export is een ZIP met de volgende structuur:

```
editie-folder/
├── index.html
└── publication-web-resources/
    ├── css/
    │   ├── idGeneratedStyles.css
    │   └── main.css
    ├── html/
    │   ├── publication.html      # Spread 1 (cover)
    │   ├── publication-1.html    # Spread 2-3
    │   └── ...                   # Per spread één HTML
    ├── image/                    # Alle afbeeldingen
    └── Thumbnails/
```

### API Response Format

Volg het standaard response format uit architecture.md:

```typescript
// Success
{
  success: true,
  data: {
    editionId: number,
    status: "processing" | "completed" | "failed",
    message: string
  }
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR" | "INTERNAL_ERROR",
    message: string
  }
}
```

### Upload API Implementation Pattern

```typescript
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import AdmZip from "adm-zip"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const xhtmlZip = formData.get("xhtml") as File | null
    const pdf = formData.get("pdf") as File | null

    if (!xhtmlZip || !pdf) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Both XHTML zip and PDF are required" } },
        { status: 400 }
      )
    }

    // Create edition with status "processing"
    const edition = await prisma.edition.create({
      data: {
        edition_number: 0, // Placeholder, will be updated after parsing
        edition_date: new Date(), // Placeholder
        status: "processing",
      },
    })

    const editionDir = join(process.cwd(), "uploads", "editions", String(edition.id))
    const xhtmlDir = join(editionDir, "xhtml")
    const pdfDir = join(editionDir, "pdf")

    // Create directories
    await mkdir(xhtmlDir, { recursive: true })
    await mkdir(pdfDir, { recursive: true })

    // Extract XHTML zip
    const xhtmlBuffer = Buffer.from(await xhtmlZip.arrayBuffer())
    const zip = new AdmZip(xhtmlBuffer)
    zip.extractAllTo(xhtmlDir, true)

    // Save PDF
    const pdfBuffer = Buffer.from(await pdf.arrayBuffer())
    await writeFile(join(pdfDir, "editie.pdf"), pdfBuffer)

    return NextResponse.json({
      success: true,
      data: { editionId: edition.id, status: "processing", message: "Upload successful, processing started" },
    })
  } catch (error) {
    console.error("[Upload API] Error:", error)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Upload failed" } },
      { status: 500 }
    )
  }
}
```

### useUpload Hook Pattern

```typescript
// src/hooks/useUpload.ts
"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

interface UploadResponse {
  success: boolean
  data?: { editionId: number; status: string; message: string }
  error?: { code: string; message: string }
}

export function useUpload() {
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: async (files: { xhtml: File; pdf: File }): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append("xhtml", files.xhtml)
      formData.append("pdf", files.pdf)

      // Use XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100))
          }
        })

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error("Upload failed"))
          }
        })

        xhr.addEventListener("error", () => reject(new Error("Network error")))

        xhr.open("POST", "/api/upload")
        xhr.send(formData)
      })
    },
  })

  return {
    upload: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    progress,
    reset: () => {
      mutation.reset()
      setProgress(0)
    },
  }
}
```

### UploadForm Component Pattern

```typescript
// src/components/editions/UploadForm.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useUpload } from "@/hooks/useUpload"
import { UploadProgress } from "./UploadProgress"

export function UploadForm() {
  const router = useRouter()
  const { upload, isLoading, error, data, progress } = useUpload()
  const [xhtmlFile, setXhtmlFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!xhtmlFile || !pdfFile) return

    upload(
      { xhtml: xhtmlFile, pdf: pdfFile },
      {
        onSuccess: (response) => {
          if (response.success && response.data) {
            router.push(`/editions/${response.data.editionId}`)
          }
        },
      }
    )
  }

  const canSubmit = xhtmlFile && pdfFile && !isLoading

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
            <label htmlFor="xhtml" className="text-sm font-medium">
              XHTML Export (ZIP)
            </label>
            <Input
              id="xhtml"
              type="file"
              accept=".zip"
              onChange={(e) => setXhtmlFile(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="pdf" className="text-sm font-medium">
              PDF Bestand
            </label>
            <Input
              id="pdf"
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
          </div>

          {isLoading && <UploadProgress progress={progress} />}

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
  )
}
```

### Metadata Extraction Pattern

```typescript
// src/services/parser/metadata-extractor.ts
import { readFile, readdir } from "fs/promises"
import { join } from "path"
import * as cheerio from "cheerio"

interface EditionMetadata {
  editionNumber: number | null
  editionDate: Date | null
}

export async function extractMetadata(xhtmlDir: string): Promise<EditionMetadata> {
  // Find HTML files in the publication-web-resources/html/ directory
  const htmlDir = join(xhtmlDir, "publication-web-resources", "html")

  try {
    const files = await readdir(htmlDir)
    const htmlFiles = files.filter(f => f.endsWith(".html"))

    for (const file of htmlFiles) {
      const content = await readFile(join(htmlDir, file), "utf-8")
      const $ = cheerio.load(content)

      // Look for edition number and date in the HTML content
      // This pattern may need adjustment based on actual InDesign export
      const text = $("body").text()

      // Example patterns - adjust based on actual format
      const editionMatch = text.match(/(?:Jaargang|Nr\.?)\s*(\d+)/i)
      const dateMatch = text.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i)

      if (editionMatch || dateMatch) {
        return {
          editionNumber: editionMatch ? parseInt(editionMatch[1]) : null,
          editionDate: dateMatch ? parseDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null,
        }
      }
    }
  } catch (error) {
    console.error("[Metadata Extractor] Error:", error)
  }

  return { editionNumber: null, editionDate: null }
}

function parseDate(day: string, month: string, year: string): Date {
  const months: Record<string, number> = {
    januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
    juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
  }
  return new Date(parseInt(year), months[month.toLowerCase()], parseInt(day))
}
```

### Dependencies Nodig

De volgende dependencies moeten worden toegevoegd:

```bash
# ZIP file handling
npm install adm-zip
npm install --save-dev @types/adm-zip

# HTML parsing (voor metadata extractie)
npm install cheerio

# React Query (indien niet al geïnstalleerd)
npm install @tanstack/react-query
```

### Project Structure Notes

Na voltooiing van deze story:

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   └── upload/
│   │       └── route.ts              # NEW: Upload API endpoint
│   └── (auth)/
│       └── editions/
│           ├── page.tsx              # Bestaand: editie lijst
│           └── upload/
│               └── page.tsx          # NEW: Upload pagina
├── components/
│   ├── editions/
│   │   ├── UploadForm.tsx           # NEW
│   │   └── UploadProgress.tsx       # NEW
│   ├── shared/
│   │   └── Header.tsx               # Update: link naar upload
│   └── ui/
├── hooks/
│   └── useUpload.ts                 # NEW
├── lib/
└── services/
    └── parser/
        └── metadata-extractor.ts    # NEW
```

### Previous Story Intelligence

**Uit Story 1-5 (Basis UI Layout):**
- shadcn/ui componenten beschikbaar: Button, Card, Input, Skeleton
- Header component in `src/components/shared/Header.tsx`
- Auth layout met SessionProvider in `src/app/(auth)/layout.tsx`
- Editions placeholder pagina op `/editions`

**Uit Story 1-4 (Authenticatie):**
- NextAuth.js geconfigureerd, login werkt
- Alle (auth) routes zijn beschermd via middleware
- API routes onder `/api/v1/*` vereisen API key (maar `/api/upload/` niet)

**Uit Story 1-3 (Database Schema):**
- Prisma client singleton in `src/lib/db.ts`
- Edition model met: id, edition_number, edition_date, status, created_at, updated_at
- Status veld kan worden gebruikt voor verwerkingsstatus

### Git Intelligence

Recent commits tonen het project pattern:
- `feat(scope): description (Story X.Y)` format
- TypeScript strict mode, alle code moet typed zijn
- Tests worden verwacht (Vitest geconfigureerd)

Suggestie voor commit:
```
feat(upload): add edition upload interface with XHTML/PDF handling (Story 2.1)
```

### Security Considerations

- Upload API is beschermd door NextAuth session (via middleware op (auth) routes)
- File type validatie: alleen .zip en .pdf accepteren
- File size limit overwegen (Next.js default is 4MB, kan worden aangepast)
- Sanitize bestandsnamen voor filesystem safety
- XHTML content wordt later geparsed, niet direct uitgevoerd

### Performance Considerations

- Upload progress tracking via XMLHttpRequest voor betere UX
- ZIP extractie is CPU-intensief, overweeg async processing
- Grote bestanden: Next.js body parser config aanpassen indien nodig

### Testing Considerations

- Mock file uploads in tests met Blob/File API
- Test upload API met FormData
- Test error cases: missing files, invalid format, disk full
- Integration test: upload → database record created

### References

- [Source: architecture.md#API & Communication Patterns] - REST response format
- [Source: architecture.md#Complete Project Directory Structure] - File locations
- [Source: architecture.md#Infrastructure & Deployment] - uploads/ volume
- [Source: prd.md#Input Format: XHTML Export] - XHTML structuur
- [Source: prd.md#Functional Requirements] - FR1, FR2, FR3, FR4
- [Source: epics.md#Story 2.1] - Acceptance Criteria
- [Source: 1-5-basis-ui-layout.md] - Bestaande UI componenten
- [Source: 1-3-database-schema.md] - Edition model

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tests: 92 passed, 0 failed
- Lint: 0 errors, 0 warnings
- Fixed: FormData parsing error door proxyClientMaxBodySize config (100MB)
- Fixed: PostgreSQL integer overflow door random negatief getal voor temp edition_number

### Completion Notes List

- Task 1: Implemented upload API endpoint with multipart form-data parsing, ZIP extraction (adm-zip), PDF storage, and Edition record creation
- Task 2: Implemented metadata extraction from XHTML files using cheerio, parsing Dutch date formats and edition numbers
- Task 3: Created UploadForm component with shadcn/ui Card, Button, Input, and Label components
- Task 4: Created useUpload hook with React Query useMutation and XMLHttpRequest for progress tracking
- Task 5: Created UploadProgress component with progress bar and step indicators
- Task 6: Created upload page at /editions/upload and added navigation link in Header
- Task 7: All unit and component tests written and passing

### File List

**New Files:**
- src/app/api/upload/route.ts
- src/app/api/upload/route.test.ts
- src/app/(auth)/editions/upload/page.tsx
- src/components/editions/UploadForm.tsx
- src/components/editions/UploadForm.test.tsx
- src/components/editions/UploadProgress.tsx
- src/components/providers/QueryProvider.tsx
- src/hooks/useUpload.ts
- src/hooks/useUpload.test.tsx
- src/services/parser/metadata-extractor.ts
- src/services/parser/metadata-extractor.test.ts
- src/types/index.ts

**Modified Files:**
- src/app/(auth)/layout.tsx (added QueryProvider)
- src/components/shared/Header.tsx (added upload link)
- vitest.config.ts (added environmentMatchGlobs for jsdom)
- next.config.ts (added proxyClientMaxBodySize for large file uploads)
- package.json (added dependencies)
- package-lock.json (dependency lockfile)
- eslint.config.mjs (added ignores for uploads/, docs/, __mocks__/)

### Change Log

- 2026-01-29: Story 2.1 implemented - Upload interface with XHTML/PDF handling
- 2026-01-29: Code review fixes applied:
  - useUpload: Implemented real upload progress tracking with XMLHttpRequest
  - useUpload: Added step state management for processing steps
  - UploadForm: Now passes step to UploadProgress component
  - API route: Added file type validation (ZIP/PDF)
  - API route: Added rollback on failure (cleanup edition record + files)
  - API route: Replaced magic numbers with named constants
  - Tests: Updated useUpload tests, added file type validation tests, added rollback tests
  - Types: Created central types/index.ts for shared types (EditionMetadata, UploadStep)
  - ESLint: Added ignores for uploads/, docs/, __mocks__/ directories
