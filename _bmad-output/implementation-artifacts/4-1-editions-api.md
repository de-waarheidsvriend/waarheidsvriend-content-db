# Story 4.1: Editions API

Status: review

## Story

Als WordPress,
Wil ik edities en hun artikelen kunnen ophalen,
Zodat ik weet welke content beschikbaar is voor publicatie.

## Acceptance Criteria

1. **Given** een geldige API Key in de `X-API-Key` header
   **When** een GET request naar `/api/v1/editions` wordt gedaan
   **Then** retourneert de API een lijst van alle edities met:
   - id, editionNumber, editionDate, articleCount, status

2. **Given** een geldige API Key
   **When** een GET request naar `/api/v1/editions/[id]` wordt gedaan
   **Then** retourneert de API de details van die specifieke editie

3. **Given** een geldige API Key
   **When** een GET request naar `/api/v1/editions/[id]/articles` wordt gedaan
   **Then** retourneert de API alle artikelen voor die editie (FR30)

4. **And** alle endpoints vereisen een geldige `X-API-Key` header

5. **Given** een ongeldige of ontbrekende API Key
   **When** een request naar `/api/v1/*` wordt gedaan
   **Then** retourneert de API een 401 Unauthorized response

6. **And** is de response tijd <500ms (NFR4)

7. **And** volgt de API REST-conventies (NFR7)

## Tasks / Subtasks

- [x] Task 1: Editions List Endpoint (AC: #1, #4, #5, #6, #7)
  - [x] 1.1 Maak `src/app/api/v1/editions/route.ts`
  - [x] 1.2 Implementeer GET handler met API Key validatie
  - [x] 1.3 Query alle edities met article count
  - [x] 1.4 Return consistent JSON response format
  - [x] 1.5 Voeg error handling toe (401 voor invalid key)

- [x] Task 2: Edition Detail Endpoint (AC: #2, #4, #5, #6, #7)
  - [x] 2.1 Maak `src/app/api/v1/editions/[id]/route.ts`
  - [x] 2.2 Implementeer GET handler met API Key validatie
  - [x] 2.3 Query editie by ID met article count
  - [x] 2.4 Return 404 voor niet-bestaande editie
  - [x] 2.5 Return consistent JSON response format

- [x] Task 3: Edition Articles Endpoint (AC: #3, #4, #5, #6, #7)
  - [x] 3.1 Maak `src/app/api/v1/editions/[id]/articles/route.ts`
  - [x] 3.2 Implementeer GET handler met API Key validatie
  - [x] 3.3 Query alle artikelen voor de editie
  - [x] 3.4 Include basic article fields (id, title, chapeau, category, pageStart, pageEnd)
  - [x] 3.5 Return 404 voor niet-bestaande editie
  - [x] 3.6 Return consistent JSON response format

- [x] Task 4: Tests schrijven
  - [x] 4.1 Unit tests voor `/api/v1/editions` endpoint
  - [x] 4.2 Unit tests voor `/api/v1/editions/[id]` endpoint
  - [x] 4.3 Unit tests voor `/api/v1/editions/[id]/articles` endpoint
  - [x] 4.4 Test API Key validatie (valid, invalid, missing)
  - [x] 4.5 Test error responses (401, 404)
  - [x] 4.6 Test response format consistency

## Dev Notes

### Architecture Compliance

Dit is Story 4.1 van Epic 4 (WordPress Content API). Deze story implementeert de basis REST endpoints voor edities.

**Architectuur uit architecture.md:**
- API routes in `src/app/api/v1/`
- API Key validatie via `X-API-Key` header
- Bestaande `src/lib/api-key.ts` middleware (uit Story 1.4)
- Consistent API response format: `{ success, data/error }`
- Gestructureerde error codes: NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED

### API Response Format

Alle endpoints volgen het consistente response format:

```typescript
// Success response
{
  success: true,
  data: { ... }
}

// Error response
{
  success: false,
  error: {
    code: "UNAUTHORIZED" | "NOT_FOUND" | "INTERNAL_ERROR",
    message: "Human readable message"
  }
}
```

### Endpoint Specifications

#### GET /api/v1/editions

Response:
```typescript
{
  success: true,
  data: Edition[]
}

interface Edition {
  id: string;
  editionNumber: number;
  editionDate: string; // ISO date
  articleCount: number;
  status: "processing" | "completed" | "completed_with_errors";
}
```

#### GET /api/v1/editions/[id]

Response:
```typescript
{
  success: true,
  data: Edition
}
```

#### GET /api/v1/editions/[id]/articles

Response:
```typescript
{
  success: true,
  data: ArticleSummary[]
}

interface ArticleSummary {
  id: string;
  title: string;
  chapeau: string | null;
  category: string | null;
  pageStart: number;
  pageEnd: number;
}
```

### API Key Validation

Use existing `validateApiKey` from `src/lib/api-key.ts`:

```typescript
import { validateApiKey } from '@/lib/api-key';

export async function GET(request: Request) {
  const authResult = validateApiKey(request);
  if (!authResult.valid) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
      { status: 401 }
    );
  }
  // ... rest of handler
}
```

### Database Queries

Use Prisma client from `src/lib/db.ts`:

```typescript
// List editions with article count
const editions = await prisma.edition.findMany({
  include: {
    _count: {
      select: { articles: true }
    }
  },
  orderBy: { editionDate: 'desc' }
});

// Single edition
const edition = await prisma.edition.findUnique({
  where: { id },
  include: { _count: { select: { articles: true } } }
});

// Articles for edition
const articles = await prisma.article.findMany({
  where: { editionId: id },
  select: {
    id: true,
    title: true,
    chapeau: true,
    category: true,
    pageStart: true,
    pageEnd: true
  },
  orderBy: { pageStart: 'asc' }
});
```

### Performance Requirements

- Response time <500ms (NFR4)
- Use efficient Prisma queries with select/include
- Consider adding database indexes if needed

### Dependencies

Geen nieuwe npm dependencies. Hergebruikt:
- Prisma client voor database access
- Bestaande API key middleware

### Files to Create

- `src/app/api/v1/editions/route.ts`
- `src/app/api/v1/editions/[id]/route.ts`
- `src/app/api/v1/editions/[id]/articles/route.ts`

### Test Files to Create

- `src/app/api/v1/editions/route.test.ts`
- `src/app/api/v1/editions/[id]/route.test.ts`
- `src/app/api/v1/editions/[id]/articles/route.test.ts`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Editions List Endpoint** (`GET /api/v1/editions`):
   - Implemented with X-API-Key header validation using existing `validateApiKey` middleware
   - Returns all editions ordered by edition_date descending
   - Response includes: id, editionNumber, editionDate (ISO), articleCount, status
   - Consistent JSON format: `{ success: true, data: [...] }`
   - 401 Unauthorized for invalid/missing API key
   - 500 Internal Error with proper error code for database failures

2. **Edition Detail Endpoint** (`GET /api/v1/editions/[id]`):
   - API Key validation on all requests
   - ID validation (numeric, positive integer)
   - 400 Bad Request for invalid ID format
   - 404 Not Found for non-existent edition
   - Returns single edition with same fields as list endpoint

3. **Edition Articles Endpoint** (`GET /api/v1/editions/[id]/articles`):
   - API Key validation on all requests
   - Checks edition exists before querying articles
   - 404 Not Found if edition doesn't exist
   - Returns articles ordered by page_start ascending
   - Article fields: id, title, chapeau, category, pageStart, pageEnd

4. **Tests** (33 total tests across 3 test files):
   - API Key validation tests (missing, invalid, valid)
   - ID validation tests (non-numeric, negative, zero)
   - Success response format tests
   - Error handling tests (database failures)
   - REST convention compliance tests

5. **All 455 project tests pass** - no regressions introduced

### File List

**Created:**
- `src/app/api/v1/editions/route.ts`
- `src/app/api/v1/editions/route.test.ts`
- `src/app/api/v1/editions/[id]/route.ts`
- `src/app/api/v1/editions/[id]/route.test.ts`
- `src/app/api/v1/editions/[id]/articles/route.ts`
- `src/app/api/v1/editions/[id]/articles/route.test.ts`

**Modified:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-editions-api.md`

## Change Log

- 2026-01-29: Story file created, status set to ready-for-dev
- 2026-01-29: Implementation complete, all endpoints created with tests, status set to review
