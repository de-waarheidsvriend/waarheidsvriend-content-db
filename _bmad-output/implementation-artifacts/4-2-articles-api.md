# Story 4.2: Articles API

Status: ready-for-dev

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

- [ ] Task 1: Article Detail Endpoint (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [ ] 1.1 Maak `src/app/api/v1/articles/[id]/route.ts`
  - [ ] 1.2 Implementeer GET handler met API Key validatie
  - [ ] 1.3 Query artikel by ID met relations (authors, images)
  - [ ] 1.4 Transform database model naar API response format
  - [ ] 1.5 Include authors inline (name, photoUrl)
  - [ ] 1.6 Include featuredImage (eerste image met is_featured=true of sort_order=0)
  - [ ] 1.7 Build contentBlocks array van article content en gerelateerde data
  - [ ] 1.8 Return 401 voor invalid/missing API key
  - [ ] 1.9 Return 404 voor niet-bestaand artikel
  - [ ] 1.10 Return consistent JSON response format

- [ ] Task 2: Content Blocks Transformer (AC: #2, #3)
  - [ ] 2.1 Maak `src/lib/content-blocks.ts` transformer module
  - [ ] 2.2 Parse article.content HTML naar paragraph blocks
  - [ ] 2.3 Extract subheadings als separate blocks
  - [ ] 2.4 Map images naar image blocks met caption
  - [ ] 2.5 Extract quotes/streamers als quote blocks
  - [ ] 2.6 Extract sidebars/kaders als sidebar blocks
  - [ ] 2.7 Sort blocks in publication order

- [ ] Task 3: Tests schrijven (AC: all)
  - [ ] 3.1 Unit tests voor `/api/v1/articles/[id]` endpoint
  - [ ] 3.2 Test API Key validatie (valid, invalid, missing)
  - [ ] 3.3 Test 404 voor niet-bestaand artikel
  - [ ] 3.4 Test response bevat alle required fields
  - [ ] 3.5 Test authors inline format
  - [ ] 3.6 Test featuredImage extraction
  - [ ] 3.7 Test contentBlocks structure en types
  - [ ] 3.8 Test content blocks order
  - [ ] 3.9 Test image URLs are directly accessible paths
  - [ ] 3.10 Unit tests voor content-blocks transformer

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

## Change Log

- 2026-01-29: Story file created, status set to ready-for-dev
