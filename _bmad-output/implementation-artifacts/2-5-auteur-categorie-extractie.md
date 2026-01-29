# Story 2.5: Auteur & Categorie Extractie

Status: done

## Story

Als systeem,
Wil ik auteurs en categorieën kunnen extraheren,
Zodat artikelen correct worden geattribueerd en gecategoriseerd.

## Acceptance Criteria

1. **Given** artikelen zijn geëxtraheerd (via Story 2.4 `extractArticles`)
   **When** de auteur-extractor draait
   **Then** worden auteursnamen geëxtraheerd uit de artikel-HTML (FR13)
   **And** worden auteursfoto's geïdentificeerd en gekoppeld (FR14)
   **And** worden nieuwe auteurs aangemaakt in de `authors` tabel
   **And** worden bestaande auteurs herkend (op naam) en hergebruikt
   **And** worden `article_authors` relaties aangemaakt

2. **Given** een artikel heeft een rubriek/categorie aanduiding
   **When** de categorie wordt geëxtraheerd
   **Then** wordt de rubriek/categorie opgeslagen in het `category` veld van het artikel (FR17)

3. **And** is er een `src/services/parser/author-extractor.ts` module
4. **And** worden auteursfoto's gekopieerd naar `uploads/editions/[id]/images/authors/`

## Tasks / Subtasks

- [x] Task 1: Type Definitions
  - [x] 1.1 Definieer `ExtractedAuthor` interface in `src/types/index.ts`
  - [x] 1.2 Definieer `AuthorExtractionResult` interface

- [x] Task 2: Author Extractor Module (AC: #1, #3)
  - [x] 2.1 Maak `src/services/parser/author-extractor.ts`
  - [x] 2.2 Implementeer `extractAuthorsFromArticles(articles: ExtractedArticle[], xhtmlExport: XhtmlExport): ExtractedAuthor[]`
  - [x] 2.3 Parse auteur-elementen uit artikel HTML met cheerio

- [x] Task 3: Author Name Extraction (AC: #1)
  - [x] 3.1 Identificeer auteursnamen via authorClasses uit StyleAnalysis
  - [x] 3.2 Parse auteursnaam uit HTML content
  - [x] 3.3 Handle meerdere auteurs per artikel (komma, "en", "&" separators)
  - [x] 3.4 Normaliseer auteursnamen (trim, capitalization)

- [x] Task 4: Author Photo Linking (AC: #1)
  - [x] 4.1 Match auteursnamen met authorPhotos uit ImageIndex
  - [x] 4.2 Implementeer fuzzy matching op naam (achternaam in bestandsnaam)
  - [x] 4.3 Koppel foto-pad aan ExtractedAuthor

- [x] Task 5: Database Integration (AC: #1)
  - [x] 5.1 Implementeer `saveAuthors(prisma, editionId, extractedAuthors, articleMap): Promise<SaveAuthorsResult>`
  - [x] 5.2 Upsert authors: zoek op naam, maak aan indien niet bestaat
  - [x] 5.3 Maak article_authors relaties aan
  - [x] 5.4 Update author.photo_url indien nieuw/beter gevonden

- [x] Task 6: Photo File Management (AC: #4)
  - [x] 6.1 Kopieer auteursfoto's naar `uploads/editions/[id]/images/authors/`
  - [x] 6.2 Genereer unieke bestandsnamen indien nodig
  - [x] 6.3 Update photo_url naar nieuwe locatie

- [x] Task 7: Category Handling (AC: #2)
  - [x] 7.1 Verifieer dat category al correct wordt geëxtraheerd in article-extractor.ts (Story 2.4)
  - [x] 7.2 Geen extra werk nodig - category wordt al verwerkt in ExtractedArticle

- [x] Task 8: Tests schrijven
  - [x] 8.1 Unit tests voor `extractAuthorsFromArticles()`
  - [x] 8.2 Unit tests voor auteursnaam parsing (meerdere auteurs, separators)
  - [x] 8.3 Unit tests voor foto matching
  - [x] 8.4 Unit tests voor `saveAuthors()` database operaties
  - [x] 8.5 Test error handling

## Dev Notes

### Architecture Compliance

Dit is Story 2.5 van Epic 2 (Editie Upload & Content Extractie). Deze story bouwt voort op de Article Extractor (Story 2.4) en produceert auteur records met artikel-relaties.

**Architectuur uit architecture.md:**
- Parser logic in `src/services/parser/` directory
- TypeScript strict mode, alle code moet getypt zijn
- Error handling: graceful degradation (NFR10), structured logging (NFR11)
- Cheerio voor HTML parsing (bestaande dependency)
- Prisma ORM voor database operaties

### Input van Story 2.4

De `extractArticles()` functie levert:
- `ExtractedArticle[]` met category al geëxtraheerd
- ArticleElement met `type: "author"` voor auteur-tekst in HTML

De `XhtmlExport` bevat:
- `images.authorPhotos: string[]` - Bestandsnamen van auteursfoto's
- `styles.authorClasses: string[]` - CSS classes voor auteur-elementen

### Author Extraction Strategy

**Stap 1: Extract author names from article HTML**
```typescript
// articleElements met type === "author" bevatten de auteurstekst
// Parse meerdere auteurs: "Jan Jansen en Piet de Vries"
const authors = parseAuthorString(authorText);
```

**Stap 2: Match photos by name**
```typescript
// authorPhotos: ["jan-jansen.jpg", "piet-de-vries.jpg"]
// Match achternaam in bestandsnaam
function matchAuthorPhoto(authorName: string, photos: string[]): string | null
```

**Stap 3: Database upsert**
```typescript
// Zoek bestaande auteur op naam
// Maak nieuwe auteur aan indien niet bestaat
// Update photo_url indien foto gevonden
```

### Type Definitions Pattern

```typescript
// src/types/index.ts - ADD these types

/**
 * Extracted author before database save
 */
export interface ExtractedAuthor {
  /** Author name (normalized) */
  name: string;
  /** Photo filename if found */
  photoFilename: string | null;
  /** Photo source path (in xhtml export) */
  photoSourcePath: string | null;
  /** Article titles this author is linked to (for mapping) */
  articleTitles: string[];
}

/**
 * Result of author extraction
 */
export interface AuthorExtractionResult {
  authors: ExtractedAuthor[];
  errors: string[];
}
```

### Database Models

```prisma
model Author {
  id         Int      @id @default(autoincrement())
  name       String   @unique
  photo_url  String?
  // ...
}

model ArticleAuthor {
  article_id Int
  author_id  Int
  @@id([article_id, author_id])
}
```

### Photo File Paths

Source: `{xhtmlExport.rootDir}/publication-web-resources/image/{filename}`
Destination: `uploads/editions/{editionId}/images/authors/{filename}`

### Naming Conventions

- Bestandsnamen: kebab-case (jan-jansen.jpg)
- Auteursnamen in DB: Originele capitalization behouden
- Matching: case-insensitive

### Dependencies

Geen nieuwe npm dependencies nodig. Gebruikt bestaande:
- `cheerio` (al geïnstalleerd)
- `@prisma/client` (al geïnstalleerd)

### Error Handling Strategy

```typescript
// Per-auteur graceful degradation (NFR10)
export async function saveAuthors(...): Promise<SaveAuthorsResult> {
  const savedAuthors: Author[] = [];
  const errors: string[] = [];

  for (const author of extractedAuthors) {
    try {
      const saved = await upsertAuthor(prisma, author);
      savedAuthors.push(saved);
    } catch (error) {
      errors.push(`Failed to save author ${author.name}: ${error}`);
      console.error(`[Author Extractor] ${error}`);
      // Continue with next author
    }
  }

  return { authors: savedAuthors, errors };
}
```

### Edge Cases to Handle

1. **Artikel zonder auteur** - Common (nieuwsberichten, redactioneel)
2. **Meerdere auteurs** - "Jan Jansen en Piet de Vries", "Jan, Piet & Klaas"
3. **Auteur zonder foto** - photo_url blijft null
4. **Dezelfde auteur in meerdere artikelen** - Hergebruik bestaande Author record
5. **Auteursnaam variaties** - "J. Jansen" vs "Jan Jansen" → behandel als verschillende auteurs (exacte match)
6. **Foto zonder matching auteur** - Skip (log warning)

### Previous Story Intelligence

**Van Story 2.4:**
- ArticleElement met type "author" bevat auteurstekst uit HTML
- Category wordt al geëxtraheerd in buildExtractedArticle()
- Per-element error handling pattern

### References

- [Source: architecture.md#Project Structure] - services/parser/ locatie
- [Source: prd.md#Functional Requirements] - FR13, FR14, FR17
- [Source: epics.md#Story 2.5] - Acceptance Criteria
- [Source: prisma/schema.prisma#Author] - Database model
- [Source: src/services/parser/article-extractor.ts] - ArticleElement, ExtractedArticle
- [Source: src/types/index.ts] - Bestaande type definitions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implemented author extraction module following patterns from Story 2.4
- Created `extractAuthorsFromArticles()` function that extracts author names from spread HTML using authorClasses from StyleAnalysis
- Implemented `parseAuthorNames()` with support for multiple separators: "en", "and", "&", ","
- Implemented `normalizeName()` to clean author names (remove prefixes like "Door:", "Tekst:", "by", trailing punctuation)
- Implemented `matchAuthorPhoto()` with fuzzy matching on full name, last name, and name parts
- Implemented `saveAuthors()` with:
  - Prisma upsert for author deduplication (match on exact name)
  - Article-author relationship creation via ArticleAuthor model
  - Photo file copying to `uploads/editions/{id}/images/authors/`
  - Per-author graceful degradation (NFR10)
- Category extraction verified: already handled in Story 2.4's `buildExtractedArticle()` function
- Added type definitions: `ExtractedAuthor`, `AuthorExtractionResult` to src/types/index.ts
- All 38 new tests pass, total 262 tests pass across the project
- No new lint errors

### File List

- `src/services/parser/author-extractor.ts` (NEW)
- `src/services/parser/author-extractor.test.ts` (NEW)
- `src/types/index.ts` (MODIFIED - added ExtractedAuthor, AuthorExtractionResult)

## Change Log

- 2026-01-29: Story created and implementation started
- 2026-01-29: Story completed - all tasks done, tests passing, status updated to done
