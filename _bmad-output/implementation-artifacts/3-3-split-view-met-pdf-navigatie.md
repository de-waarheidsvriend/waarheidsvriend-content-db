# Story 3.3: Split-View met PDF Navigatie

Status: done

## Story

Als Joost,
Wil ik de PDF-spread naast de geparsede content kunnen zien,
Zodat ik visueel kan verifiëren of alles correct is geëxtraheerd.

## Acceptance Criteria

1. **Given** ik ben in de review interface
   **When** ik een artikel bekijk
   **Then** zie ik een split-view met:
   - Links: PDF-spread(s) van de pagina's waar het artikel staat (FR27)
   - Rechts: Geparsede artikel content

2. **Given** een artikel loopt over meerdere spreads
   **When** ik de PDF-view bekijk
   **Then** kan ik bladeren tussen de relevante spreads

3. **Given** ik bekijk een artikel
   **When** ik wil navigeren
   **Then** kan ik naar het vorige/volgende artikel navigeren (FR28)
   **And** zijn er "Vorige" en "Volgende" knoppen
   **And** kan ik met keyboard shortcuts navigeren (← →)

4. **And** is er een `src/app/(auth)/review/[editionId]/page.tsx` voor de split-view
5. **And** is er een `src/components/review/SplitView.tsx` component
6. **And** is er een `src/components/review/PdfSpreadView.tsx` component
7. **And** is er een `src/components/review/ArticleNavigation.tsx` component

## Tasks / Subtasks

- [x] Task 1: Review Page Implementation (AC: #1, #4)
  - [x] 1.1 Maak `src/app/(auth)/review/[editionId]/page.tsx`
  - [x] 1.2 Implementeer URL parameter parsing (editionId, article query param)
  - [x] 1.3 Fetch edition met artikelen via useEdition hook
  - [x] 1.4 Toon loading skeleton tijdens data fetch
  - [x] 1.5 Handle error states (invalid ID, not found)

- [x] Task 2: SplitView Component (AC: #1, #5)
  - [x] 2.1 Maak `src/components/review/SplitView.tsx`
  - [x] 2.2 Implementeer 50/50 split layout
  - [x] 2.3 Links: PdfSpreadView component
  - [x] 2.4 Rechts: ArticleView component (hergebruik Story 3.2)

- [x] Task 3: PdfSpreadView Component (AC: #1, #2, #6)
  - [x] 3.1 Maak `src/components/review/PdfSpreadView.tsx`
  - [x] 3.2 Maak `src/hooks/usePageImages.ts` hook
  - [x] 3.3 Maak API endpoint `/api/editions/[id]/page-images`
  - [x] 3.4 Implementeer spread grouping (page 1 solo, 2-3, 4-5, etc.)
  - [x] 3.5 Toon spreads voor artikel's pageStart-pageEnd range
  - [x] 3.6 Implementeer spread navigatie bij multi-spread artikelen

- [x] Task 4: ArticleNavigation Component (AC: #3, #7)
  - [x] 4.1 Maak `src/components/review/ArticleNavigation.tsx`
  - [x] 4.2 Implementeer "Vorige" en "Volgende" knoppen
  - [x] 4.3 Toon huidige artikel positie (X van Y)
  - [x] 4.4 Implementeer keyboard shortcuts (← →)
  - [x] 4.5 Disable knoppen bij eerste/laatste artikel

- [x] Task 5: Code Review Fixes
  - [x] 5.1 Fix: currentSpreadIndex reset niet bij artikel-navigatie
  - [x] 5.2 Fix: Spread logic correctie (page 1 solo, even-odd pairing)
  - [x] 5.3 Fix: Gebruik `<img>` tag ipv Next.js Image voor dynamische uploads
  - [x] 5.4 Fix: Voeg ARIA labels toe voor toegankelijkheid
  - [x] 5.5 Voeg role="status" en aria-live toe voor screen readers

- [x] Task 6: Tests schrijven
  - [x] 6.1 Unit tests voor ArticleNavigation (13 tests)
  - [x] 6.2 Unit tests voor PdfSpreadView (11 tests)
  - [x] 6.3 Unit tests voor SplitView (4 tests)
  - [x] 6.4 Unit tests voor usePageImages hook (4 tests)
  - [x] 6.5 API tests voor page-images endpoint (6 tests)

## Dev Notes

### Architecture Compliance

Dit is Story 3.3 van Epic 3 (Review Interface). Deze story bouwt voort op Story 3.1 (Editie Overzicht) en Story 3.2 (Artikel Detail View).

**Architectuur uit architecture.md:**
- React components in `src/components/review/`
- App Router pages in `src/app/(auth)/`
- React Query voor data fetching
- shadcn/ui componenten
- Consistent API response format: `{ success, data/error }`

### Component Structure

```
/review/[editionId]/page.tsx
├── ReviewPageSkeleton (loading state)
├── ReviewContent
│   ├── ArticleNavigation (prev/next + keyboard)
│   └── SplitView
│       ├── PdfSpreadView (left panel)
│       └── ArticleView (right panel - from Story 3.2)
```

### PDF Spread Logic

Magazine spreads volgen dit patroon:
- Pagina 1: Cover, altijd alleen
- Pagina 2-3: Eerste spread (even links, oneven rechts)
- Pagina 4-5: Tweede spread
- etc.

```typescript
// Spread grouping logic
if (pageNum === 1) {
  // Cover alone
} else if (pageNum % 2 === 0) {
  // Even page starts spread (left side)
  // Look for matching odd page (right side)
} else {
  // Odd page > 1 alone if no partner
}
```

### Keyboard Navigation

- `←` (ArrowLeft): Vorig artikel
- `→` (ArrowRight): Volgend artikel
- Disabled wanneer in input/textarea
- useEffect cleanup voor event listener

### Accessibility Improvements

- `role="status"` + `aria-live="polite"` voor artikel counter
- `aria-label` op navigatie knoppen met sneltoets info
- `<nav aria-label="PDF spread navigatie">` voor spread controls

### API Endpoint

```typescript
// GET /api/editions/[id]/page-images
// Response: { success: true, data: PageImage[] }
// PageImage: { id, pageNumber, imageUrl }
```

### Code Review Issues Fixed

1. **Spread index reset**: `useEffect` toegevoegd om `currentSpreadIndex` te resetten bij artikel wisseling
2. **Image component**: `<img>` tag ipv Next.js `<Image>` omdat uploads dynamische URLs hebben
3. **Spread logic**: Correcte even-oneven pairing voor magazine spreads
4. **ARIA labels**: Toegevoegd voor toegankelijkheid

### Test Coverage

- ArticleNavigation: 13 tests (navigation, keyboard, disabled states, accessibility)
- PdfSpreadView: 11 tests (loading, error, spreads, navigation)
- SplitView: 4 tests (props passing, rendering)
- usePageImages: 4 tests (fetch, null handling, errors)
- API route: 6 tests (validation, not found, success, errors)

### Dependencies

Geen nieuwe npm dependencies. Hergebruikt:
- `@tanstack/react-query` voor data fetching
- `shadcn/ui` Button, Skeleton components
- Bestaande `ArticleView` component van Story 3.2

### Error Handling

- Invalid editionId → error message + back button
- Edition not found → error message + back button
- API errors → display in PdfSpreadView
- Geen page images → informatief bericht

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Initial implementation created via commit 2aa3e64
- Code review fixes applied for:
  - Spread index reset on article navigation
  - Magazine spread logic (page 1 solo, even-odd pairs)
  - Native img tag for dynamic uploads
  - ARIA accessibility improvements
- 38 new tests added, all 345 tests pass
- No lint errors

### File List

Files created/modified in original implementation:
- `src/app/(auth)/review/[editionId]/page.tsx` (NEW)
- `src/app/api/editions/[id]/page-images/route.ts` (NEW)
- `src/components/review/SplitView.tsx` (NEW)
- `src/components/review/PdfSpreadView.tsx` (NEW)
- `src/components/review/ArticleNavigation.tsx` (NEW)
- `src/hooks/usePageImages.ts` (NEW)
- `src/app/(auth)/editions/[id]/page.tsx` (MODIFIED - added review link)
- `src/components/editions/ArticleCard.tsx` (MODIFIED - added review link)

Files modified in code review fixes:
- `src/components/review/PdfSpreadView.tsx` (MODIFIED - spread logic, img tag, useEffect reset)
- `src/components/review/ArticleNavigation.tsx` (MODIFIED - ARIA labels)

Test files added:
- `src/components/review/ArticleNavigation.test.tsx` (NEW)
- `src/components/review/PdfSpreadView.test.tsx` (NEW)
- `src/components/review/SplitView.test.tsx` (NEW)
- `src/hooks/usePageImages.test.tsx` (NEW)
- `src/app/api/editions/[id]/page-images/route.test.ts` (NEW)

## Change Log

- 2026-01-29: Story created and initial implementation completed (commit 2aa3e64)
- 2026-01-29: Code review fixes applied - spread logic, img tag, ARIA labels
- 2026-01-29: Tests added (38 new tests), all 345 tests passing
- 2026-01-29: Story completed - status updated to done
