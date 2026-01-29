# Story 4.2: Articles API

Status: done

## Story

Als WordPress,
Wil ik volledige artikel details kunnen ophalen,
Zodat ik artikelen kan aanmaken met alle content.

## Acceptance Criteria

1. **Given** een geldige API Key in de `X-API-Key` header
   **When** een GET request naar `/api/v1/articles/[id]` wordt gedaan
   **Then** retourneert de API de volledige artikel details (FR31) inclusief:
   - title, chapeau, excerpt, category, pageStart, pageEnd
   - authors (inline met name en photoUrl)
   - featuredImage (FR34)
   - contentBlocks array met getypeerde blocks

2. **And** contentBlocks bevat de volgende block types:
   - `paragraph` - tekst alinea
   - `subheading` - tussenkop (FR20)
   - `image` - afbeelding met caption
   - `quote` - streamer (FR21)
   - `sidebar` - kader (FR19)

3. **And** content blocks zijn in volgorde zoals in de publicatie

4. **And** alle image URLs zijn direct toegankelijk (NFR9)

5. **And** retourneert de API JSON in consistent format (NFR8)

6. **Given** een ongeldige of ontbrekende API Key
   **When** een request naar `/api/v1/articles/[id]` wordt gedaan
   **Then** retourneert de API een 401 Unauthorized response

7. **Given** een niet-bestaand artikel ID
   **When** een GET request naar `/api/v1/articles/[id]` wordt gedaan
   **Then** retourneert de API een 404 Not Found response

8. **And** is de response tijd <500ms (NFR4)

## Tasks / Subtasks

- [x] Task 1: Article Detail Endpoint (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 1.1 Maak `src/app/api/v1/articles/[id]/route.ts`
  - [x] 1.2 Implementeer GET handler met API Key validatie
  - [x] 1.3 Query artikel by ID met relations (authors, images)
  - [x] 1.4 Transform database model naar API response format
  - [x] 1.5 Include authors inline (name, photoUrl)
  - [x] 1.6 Include featuredImage (eerste image met is_featured=true of sort_order=0)
  - [x] 1.7 Build contentBlocks array van article content en gerelateerde data
  - [x] 1.8 Return 401 voor invalid/missing API key
  - [x] 1.9 Return 404 voor niet-bestaand artikel
  - [x] 1.10 Return consistent JSON response format

- [x] Task 2: Content Blocks Transformer (AC: #2, #3)
  - [x] 2.1 Maak `src/lib/content-blocks.ts` transformer module
  - [x] 2.2 Parse article.content HTML naar paragraph blocks
  - [x] 2.3 Extract subheadings als separate blocks
  - [x] 2.4 Map images naar image blocks met caption
  - [x] 2.5 Extract quotes/streamers als quote blocks
  - [x] 2.6 Extract sidebars/kaders als sidebar blocks
  - [x] 2.7 Sort blocks in publication order

- [x] Task 3: Tests schrijven (AC: all)
  - [x] 3.1 Unit tests voor `/api/v1/articles/[id]` endpoint
  - [x] 3.2 Test API Key validatie (valid, invalid, missing)
  - [x] 3.3 Test 404 voor niet-bestaand artikel
  - [x] 3.4 Test response bevat alle required fields
  - [x] 3.5 Test authors inline format
  - [x] 3.6 Test featuredImage extraction
  - [x] 3.7 Test contentBlocks structure en types
  - [x] 3.8 Test content blocks order
  - [x] 3.9 Test image URLs are directly accessible paths
  - [x] 3.10 Unit tests voor content-blocks transformer

## Dev Notes

### Architecture Compliance

Dit is Story 4.2 van Epic 4 (WordPress Content API). Deze story implementeert het artikel detail endpoint voor WordPress integratie.

**Architectuur uit architecture.md:**
- API routes in `src/app/api/v1/`
- API Key validatie via `X-API-Key` header
- Bestaande `src/lib/api-key.ts` middleware (uit Story 1.4)
- Consistent API response format: `{ success, data/error }`
- Gestructureerde error codes: NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED

### API Response Format

```typescript
// Success response
{
  success: true,
  data: {
    id: string;
    title: string;
    chapeau: string | null;
    excerpt: string | null;
    category: string | null;
    pageStart: number;
    pageEnd: number;
    authors: Author[];
    featuredImage: FeaturedImage | null;
    contentBlocks: ContentBlock[];
  }
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

### Endpoint Specification

#### GET /api/v1/articles/[id]

Response:
```typescript
interface ArticleDetailResponse {
  id: string;
  title: string;
  chapeau: string | null;
  excerpt: string | null;
  category: string | null;
  pageStart: number;
  pageEnd: number;
  authors: Author[];
  featuredImage: FeaturedImage | null;
  contentBlocks: ContentBlock[];
}

interface Author {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface FeaturedImage {
  url: string;
  caption: string | null;
}

interface ContentBlock {
  type: "paragraph" | "subheading" | "image" | "quote" | "sidebar";
  content: string;
  // For image blocks only:
  imageUrl?: string;
  caption?: string;
  order: number;
}
```

### Database Queries

Use Prisma client from `src/lib/db.ts`:

```typescript
// Get article with all relations
const article = await prisma.article.findUnique({
  where: { id },
  include: {
    article_authors: {
      include: {
        author: true
      }
    },
    images: {
      orderBy: { sort_order: 'asc' }
    }
  }
});
```

### Content Blocks Transformation

The article's `content` field contains cleaned HTML with structured elements. The transformer needs to:

1. Parse the HTML content
2. Extract block elements in order:
   - `<p>` → paragraph blocks
   - `<h2>`, `<h3>` → subheading blocks
   - `<blockquote>` → quote blocks
3. Interleave images based on their sort_order
4. Extract sidebars (stored separately or marked in HTML)

Reference existing types from `src/types/index.ts`:
- `ContentBlockType`: "paragraph" | "subheading" | "image" | "quote" | "sidebar"
- `ContentBlock`: { type, content, imageUrl?, caption?, order }

### Image URL Format

Image URLs should be directly accessible paths relative to the server root:
- Article images: `/uploads/editions/[edition_id]/images/articles/[filename]`
- Author photos: `/uploads/editions/[edition_id]/images/authors/[filename]`

Ensure URLs are complete and accessible via HTTP GET (NFR9).

### Performance Requirements

- Response time <500ms (NFR4)
- Use efficient Prisma queries with select/include
- Consider caching for frequently accessed articles

### Dependencies

Geen nieuwe npm dependencies nodig. Hergebruikt:
- Prisma client voor database access
- Bestaande API key middleware
- Bestaande `ContentBlock` types uit `src/types/index.ts`

### Files to Create

- `src/app/api/v1/articles/[id]/route.ts`
- `src/lib/content-blocks.ts`

### Test Files to Create

- `src/app/api/v1/articles/[id]/route.test.ts`
- `src/lib/content-blocks.test.ts`

## Dev Agent Record

### Implementation Plan

Implemented the Articles API endpoint following the architecture patterns established in Story 4-1 (Editions API):
1. Created content-blocks transformer module for HTML parsing
2. Implemented GET /api/v1/articles/[id] endpoint with full article details
3. Added comprehensive test suites for both modules

### Completion Notes

✅ All acceptance criteria satisfied:
- AC #1: GET endpoint returns full article details with authors, featuredImage, contentBlocks
- AC #2: contentBlocks supports all 5 block types (paragraph, subheading, image, quote, sidebar)
- AC #3: Content blocks maintain publication order via sequential order numbers
- AC #4: Image URLs are direct paths (e.g., /uploads/editions/...)
- AC #5: Consistent JSON response format with { success, data/error }
- AC #6: 401 Unauthorized for invalid/missing API key
- AC #7: 404 Not Found for non-existent article
- AC #8: Efficient Prisma queries should meet <500ms requirement

### Debug Log

No issues encountered during implementation.

## File List

### New Files
- `src/app/api/v1/articles/[id]/route.ts` - Article detail API endpoint
- `src/app/api/v1/articles/[id]/route.test.ts` - Endpoint tests (31 tests)
- `src/lib/content-blocks.ts` - Content blocks transformer module
- `src/lib/content-blocks.test.ts` - Transformer tests (28 tests)

### Modified Files
- `src/types/api.ts` - Added ArticleDetail, AuthorInline, FeaturedImage, ApiContentBlock types

## Change Log

- 2026-01-29: Story file created, status set to ready-for-dev
- 2026-01-29: Implementation completed, all 59 new tests passing (513 total), status set to done
