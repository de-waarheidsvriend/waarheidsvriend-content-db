# Story 2.4: Artikel Extractie

Status: done

## Story

Als systeem,
Wil ik individuele artikelen kunnen extraheren uit de XHTML,
Zodat elk artikel als aparte entiteit in de database staat.

## Acceptance Criteria

1. **Given** de XHTML is geladen en geanalyseerd (via Story 2.3 `loadXhtmlExport`)
   **When** de artikel-extractor draait
   **Then** worden individuele artikelen geïdentificeerd (FR9)
   **And** wordt voor elk artikel de titel geëxtraheerd (FR10)
   **And** wordt voor elk artikel de chapeau geëxtraheerd (FR11)
   **And** wordt voor elk artikel de body-content geëxtraheerd als schone HTML (FR12):
   - InDesign-specifieke spans/divs verwijderd
   - Lege elementen verwijderd
   - Semantische HTML behouden (p, h2, h3, blockquote, etc.)

2. **Given** een artikel loopt over meerdere spreads
   **When** de extractor dit detecteert (via CSS classes of ID patterns)
   **Then** wordt de content van alle spreads samengevoegd tot één artikel (FR8)
   **And** worden `page_start` en `page_end` correct gezet

3. **And** is er een `src/services/parser/article-extractor.ts` module
4. **And** worden artikelen opgeslagen in de `articles` tabel gekoppeld aan de editie

## Tasks / Subtasks

- [x] Task 1: Article Extractor Module (AC: #1, #3)
  - [x] 1.1 Maak `src/services/parser/article-extractor.ts`
  - [x] 1.2 Implementeer `extractArticles(xhtmlExport: XhtmlExport): Promise<ExtractedArticle[]>`
  - [x] 1.3 Gebruik StyleAnalysis uit Story 2.3 om artikel-elementen te identificeren
  - [x] 1.4 Parse elke spread HTML met cheerio voor artikel-detectie
  - [x] 1.5 Return array van ExtractedArticle objecten

- [x] Task 2: Artikel Herkenning (AC: #1)
  - [x] 2.1 Identificeer artikelen via titleClasses uit StyleAnalysis
  - [x] 2.2 Groepeer content-elementen per artikel (titel → volgende content tot nieuwe titel)
  - [x] 2.3 Handle edge case: cover spread heeft vaak geen artikelen
  - [x] 2.4 Handle edge case: advertenties/rubrieken zonder titel

- [x] Task 3: Content Extractie per Artikel (AC: #1)
  - [x] 3.1 Extraheer titel via titleClasses (FR10)
  - [x] 3.2 Extraheer chapeau via chapeauClasses (FR11)
  - [x] 3.3 Extraheer body via bodyClasses (FR12)
  - [x] 3.4 Leg page_start en page_end vast uit spread info

- [x] Task 4: HTML Cleaning (AC: #1)
  - [x] 4.1 Verwijder InDesign-specifieke elementen (CharOverride, ParaOverride, _idGen spans)
  - [x] 4.2 Verwijder lege elementen (<p></p>, <span></span>)
  - [x] 4.3 Behoud semantische HTML (p, h2, h3, blockquote, strong, em, a)
  - [x] 4.4 Normaliseer whitespace en newlines
  - [x] 4.5 Maak `cleanHtml(html: string): string` utility functie

- [x] Task 5: Multi-Spread Artikel Detectie (AC: #2)
  - [x] 5.1 Detecteer artikelen die over meerdere spreads lopen
  - [x] 5.2 Implementeer heuristics: onafgemaakte body tekst, ID/class continuiteit
  - [x] 5.3 Merge content van opeenvolgende spreads tot één artikel
  - [x] 5.4 Update page_start (eerste spread) en page_end (laatste spread)

- [x] Task 6: Type Definitions
  - [x] 6.1 Definieer `ExtractedArticle` interface in `src/types/index.ts`
  - [x] 6.2 Definieer `ArticleElement` interface voor tussentijdse parsing
  - [x] 6.3 Export types voor gebruik in andere modules

- [x] Task 7: Database Integration (AC: #4)
  - [x] 7.1 Maak `saveArticles(editionId: number, articles: ExtractedArticle[]): Promise<Article[]>`
  - [x] 7.2 Gebruik Prisma client voor database operaties
  - [x] 7.3 Bulk insert artikelen gekoppeld aan edition_id
  - [x] 7.4 Return created Article records met IDs

- [x] Task 8: Tests schrijven
  - [x] 8.1 Unit tests voor `extractArticles()`
  - [x] 8.2 Unit tests voor `cleanHtml()`
  - [x] 8.3 Unit tests voor multi-spread detectie
  - [x] 8.4 Integration test met mock XhtmlExport data
  - [x] 8.5 Test error handling voor malformed HTML

## Dev Notes

### Architecture Compliance

Dit is Story 2.4 van Epic 2 (Editie Upload & Content Extractie). Deze story bouwt voort op de XHTML Loader (Story 2.3) en produceert artikel records voor de database.

**Architectuur uit architecture.md:**
- Parser logic in `src/services/parser/` directory
- TypeScript strict mode, alle code moet getypt zijn
- Error handling: graceful degradation per artikel (NFR10), structured logging (NFR11)
- Cheerio voor HTML parsing (bestaande dependency)
- Prisma ORM voor database operaties

### Input van Story 2.3

De `loadXhtmlExport()` functie uit Story 2.3 levert:

```typescript
interface XhtmlExport {
  rootDir: string;                    // Base directory
  spreads: LoadedSpread[];           // HTML content per spread
  images: ImageIndex;                // Image filename → path mapping
  styles: StyleAnalysis;             // Class categorisatie (CRUCIAAL!)
  metadata: EditionMetadata;         // Edition number/date
  errors: string[];                  // Eventuele laadfouten
}

interface LoadedSpread {
  filename: string;
  spreadIndex: number;
  pageStart: number;                 // e.g., 2
  pageEnd: number;                   // e.g., 3
  html: string;                      // Raw HTML content
}

interface StyleAnalysis {
  classMap: Map<string, string>;     // "Hoofdkop" → "title"
  titleClasses: string[];            // ["Hoofdkop", "Titel", ...]
  chapeauClasses: string[];          // ["Chapeau", "Intro", ...]
  bodyClasses: string[];             // ["Platte-tekst", "Broodtekst", ...]
  authorClasses: string[];           // ["Auteur", ...]
  categoryClasses: string[];         // ["Rubriek", "Thema", ...]
  articleBoundaryClasses: string[];  // Explicit article markers
}
```

### Article Extraction Strategy

**Stap 1: Identifier artikelen via titels**
```typescript
// Elke spread wordt geparsed met cheerio
const $ = cheerio.load(spread.html);

// Zoek alle titel-elementen
const titleSelectors = styles.titleClasses.map(c => `.${c}`).join(', ');
const titles = $(titleSelectors);

// Elk titel-element markeert het begin van een artikel
```

**Stap 2: Verzamel content per artikel**
```typescript
// Van titel tot volgende titel (of einde spread)
// Chapeau: eerste element met chapeauClass na titel
// Body: alle elementen met bodyClass tot volgende titel
```

**Stap 3: Multi-spread detectie**
```typescript
// Heuristics:
// 1. Laatste body paragraph eindigt niet met punt/vraag/uitroepteken
// 2. Volgende spread begint met bodyClass zonder voorafgaande titel
// 3. InDesign continuation IDs (als aanwezig)
```

### Type Definitions Pattern

```typescript
// src/types/index.ts - ADD these types

/**
 * Extracted article before database save
 */
export interface ExtractedArticle {
  /** Article title (cleaned text) */
  title: string;
  /** Chapeau/intro text (cleaned, optional) */
  chapeau: string | null;
  /** Body content as cleaned HTML */
  content: string;
  /** Excerpt (first ~150 chars of body, plain text) */
  excerpt: string | null;
  /** Category/rubriek if detected */
  category: string | null;
  /** First page where article appears */
  pageStart: number;
  /** Last page where article appears */
  pageEnd: number;
  /** Source spreads (for debugging) */
  sourceSpreadIndexes: number[];
  /** Images referenced in this article (filenames) */
  referencedImages: string[];
}

/**
 * Intermediate element during parsing
 */
export interface ArticleElement {
  type: 'title' | 'chapeau' | 'body' | 'author' | 'category' | 'image' | 'unknown';
  content: string;
  className: string;
  spreadIndex: number;
  pageStart: number;
  pageEnd: number;
}
```

### HTML Cleaning Rules

```typescript
/**
 * Clean InDesign-generated HTML to semantic HTML
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // 1. Remove InDesign override spans (keep content)
  $('[class*="CharOverride"], [class*="ParaOverride"], [class*="_idGen"]').each((_, el) => {
    $(el).replaceWith($(el).html() || '');
  });

  // 2. Remove empty elements
  $('p:empty, span:empty, div:empty').remove();

  // 3. Unwrap unnecessary wrapper divs
  $('div').each((_, el) => {
    const $el = $(el);
    if (!$el.attr('class') && !$el.attr('id')) {
      $el.replaceWith($el.html() || '');
    }
  });

  // 4. Normalize whitespace
  let cleaned = $.html();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/>\s+</g, '><');

  return cleaned.trim();
}
```

### Database Model (from prisma/schema.prisma)

```prisma
model Article {
  id         Int      @id @default(autoincrement())
  edition_id Int
  title      String
  chapeau    String?
  content    String      // Cleaned HTML body
  excerpt    String?     // Plain text excerpt
  category   String?
  page_start Int?
  page_end   Int?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  edition         Edition         @relation(...)
  images          Image[]         // Story 2.6
  article_authors ArticleAuthor[] // Story 2.5
}
```

### Project Structure After Story

Na voltooiing van deze story:

```
src/
├── services/
│   ├── parser/
│   │   ├── metadata-extractor.ts        # Story 2.1
│   │   ├── xhtml-loader.ts              # Story 2.3
│   │   ├── structure-analyzer.ts        # Story 2.3
│   │   ├── article-extractor.ts         # NEW
│   │   ├── article-extractor.test.ts    # NEW
│   │   └── html-cleaner.ts              # NEW (utility)
├── types/
│   └── index.ts                         # Extended with ExtractedArticle
└── ...
```

### Existing Code Patterns to Follow

**Van structure-analyzer.ts:**
- Classification helper functions
- Graceful error handling met try/catch
- Console logging format: `[Module Name] Message`

**Van xhtml-loader.ts:**
- Path validation met `validatePath()`
- Error array in return type voor graceful degradation
- Gebruik `cheerio.load(html)` voor parsing

**Van prisma schema:**
- Artikel fields: title, chapeau, content, excerpt, category, page_start, page_end
- edition_id als foreign key

### Dependencies

Geen nieuwe npm dependencies nodig. Gebruikt bestaande:
- `cheerio` (al geïnstalleerd)
- `@prisma/client` (al geïnstalleerd)

### Error Handling Strategy

```typescript
// Per-artikel graceful degradation (NFR10)
export async function extractArticles(xhtmlExport: XhtmlExport): Promise<{
  articles: ExtractedArticle[];
  errors: string[];
}> {
  const articles: ExtractedArticle[] = [];
  const errors: string[] = [];

  for (const spread of xhtmlExport.spreads) {
    try {
      const spreadArticles = extractFromSpread(spread, xhtmlExport.styles);
      articles.push(...spreadArticles);
    } catch (error) {
      const errorMsg = `Failed to extract from spread ${spread.spreadIndex}: ${error}`;
      errors.push(errorMsg);
      console.error(`[Article Extractor] ${errorMsg}`);
      // Continue with next spread
    }
  }

  return { articles, errors };
}
```

### Previous Story Intelligence

**Van Story 2.3 Review:**
- Path validation is cruciaal voor security
- Test mocks moeten ALLE exported functions mocken
- StyleAnalysis classMap bevat 32+ class mappings uit echte InDesign exports
- HTML class analyse is belangrijker dan CSS analyse (InDesign plaatst semantiek in HTML)

**Geleerde lessen:**
1. Mock alle dependencies compleet in tests
2. Cheerio instance hoeft niet opgeslagen - parse on-demand
3. Gebruik `IMAGE_EXTENSIONS` constant pattern voor magic strings

### Performance Considerations

- Typische editie: 12 spreads, ~15 artikelen
- Cheerio parsing is snel (<10ms per spread)
- Database bulk insert efficiënter dan per-artikel
- Target: volledige extractie <30s (ruim binnen NFR1: 2 min)

### Security Considerations

- Input validatie: XhtmlExport komt van Story 2.3 (al gevalideerd)
- HTML sanitization: cleanHtml verwijdert ongewenste elementen
- Geen user input direct in SQL (Prisma parameterized queries)

### Git Intelligence

Recent commit pattern:
```
feat(parser): add XHTML loader and structure analyzer (Story 2.3)
feat(pdf): add PDF to images converter service (Story 2.2)
```

Suggestie voor commit:
```
feat(parser): add article extraction from XHTML exports (Story 2.4)
```

### Edge Cases to Handle

1. **Cover spread (index 0)** - Vaak geen artikelen, alleen cover afbeelding
2. **Advertentiepagina's** - Geen titel, alleen afbeeldingen → skip
3. **Rubrieken zonder body** - Titel + chapeau maar geen body → valid article
4. **Zeer lange artikelen** - 4+ spreads → merge alle content
5. **Artikelen zonder chapeau** - Common, chapeau is optional
6. **Malformed HTML** - Cheerio is tolerant, maar log warnings

### References

- [Source: architecture.md#Project Structure] - services/parser/ locatie
- [Source: architecture.md#Implementation Patterns] - naming conventions, error handling
- [Source: architecture.md#Error Handling] - per-artikel graceful degradation
- [Source: prd.md#Functional Requirements] - FR8, FR9, FR10, FR11, FR12
- [Source: epics.md#Story 2.4] - Acceptance Criteria
- [Source: prisma/schema.prisma#Article] - Database model
- [Source: src/services/parser/xhtml-loader.ts] - XhtmlExport interface
- [Source: src/services/parser/structure-analyzer.ts] - StyleAnalysis, classifyClassName pattern
- [Source: src/types/index.ts] - Bestaande type definitions
- [Source: 2-3-xhtml-loader-structure-analyzer.md#Dev Notes] - Vorige story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implemented article extraction from XHTML exports following the architecture patterns from Story 2.3
- Created `html-cleaner.ts` utility with `cleanHtml()`, `htmlToPlainText()`, and `generateExcerpt()` functions
- Created `article-extractor.ts` with `extractArticles()` and `saveArticles()` functions
- Added type definitions: `ExtractedArticle`, `ArticleElement`, `ArticleExtractionResult` to `src/types/index.ts`
- Multi-spread article detection implemented using heuristics (incomplete text, consecutive spreads, no new title)
- Category elements appearing before titles are correctly associated with the following article
- All 51 new tests pass, total 221 tests pass across the project
- Lint errors fixed, code follows project patterns

### Code Review Fixes (2026-01-29)

- **M1 FIXED**: Added missing `scripts/test-article-extractor.ts` to File List
- **M2 FIXED**: Added error handling tests for `saveArticles()` (database failure, connection refused, empty array)
- **M3 FIXED**: `saveArticles()` now returns `SaveArticlesResult` with `{ articles, errors }` and wraps transaction in try/catch
- **M4 NOTE**: `referencedImages` array is extracted but not persisted to database - this is by design, image association is Story 2.6 scope
- **M5 FIXED**: Multi-spread merge heuristic now includes ":" and "-" as valid sentence-ending punctuation (common in Dutch lists)

### File List

- `src/services/parser/article-extractor.ts` (NEW)
- `src/services/parser/article-extractor.test.ts` (NEW)
- `src/services/parser/html-cleaner.ts` (NEW)
- `src/services/parser/html-cleaner.test.ts` (NEW)
- `src/types/index.ts` (MODIFIED - added ExtractedArticle, ArticleElement, ArticleExtractionResult)
- `scripts/test-article-extractor.ts` (NEW - manual integration test script)

## Change Log

- 2026-01-29: Story created by SM workflow with comprehensive context from Story 2.3
- 2026-01-29: Story implemented - all tasks completed, tests passing, ready for review
- 2026-01-29: Code review completed - 5 MEDIUM issues fixed, status updated to done
