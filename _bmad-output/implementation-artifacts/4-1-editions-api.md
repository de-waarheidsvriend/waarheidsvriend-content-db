# Story 4.1: Editions API

Status: ready-for-dev

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

- [ ] Task 1: Editions List Endpoint (AC: #1, #4, #5, #6, #7)
  - [ ] 1.1 Maak `src/app/api/v1/editions/route.ts`
  - [ ] 1.2 Implementeer GET handler met API Key validatie
  - [ ] 1.3 Query alle edities met article count
  - [ ] 1.4 Return consistent JSON response format
  - [ ] 1.5 Voeg error handling toe (401 voor invalid key)

- [ ] Task 2: Edition Detail Endpoint (AC: #2, #4, #5, #6, #7)
  - [ ] 2.1 Maak `src/app/api/v1/editions/[id]/route.ts`
  - [ ] 2.2 Implementeer GET handler met API Key validatie
  - [ ] 2.3 Query editie by ID met article count
  - [ ] 2.4 Return 404 voor niet-bestaande editie
  - [ ] 2.5 Return consistent JSON response format

- [ ] Task 3: Edition Articles Endpoint (AC: #3, #4, #5, #6, #7)
  - [ ] 3.1 Maak `src/app/api/v1/editions/[id]/articles/route.ts`
  - [ ] 3.2 Implementeer GET handler met API Key validatie
  - [ ] 3.3 Query alle artikelen voor de editie
  - [ ] 3.4 Include basic article fields (id, title, chapeau, category, pageStart, pageEnd)
  - [ ] 3.5 Return 404 voor niet-bestaande editie
  - [ ] 3.6 Return consistent JSON response format

- [ ] Task 4: Tests schrijven
  - [ ] 4.1 Unit tests voor `/api/v1/editions` endpoint
  - [ ] 4.2 Unit tests voor `/api/v1/editions/[id]` endpoint
  - [ ] 4.3 Unit tests voor `/api/v1/editions/[id]/articles` endpoint
  - [ ] 4.4 Test API Key validatie (valid, invalid, missing)
  - [ ] 4.5 Test error responses (401, 404)
  - [ ] 4.6 Test response format consistency

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

(To be filled after implementation)

### Completion Notes List

(To be filled after implementation)

### File List

(To be filled after implementation)

## Change Log

- 2026-01-29: Story file created, status set to ready-for-dev
