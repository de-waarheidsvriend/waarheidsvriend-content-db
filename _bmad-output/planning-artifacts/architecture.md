---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-waarheidsvriend-content-db-2026-01-29.md
workflowType: 'architecture'
project_name: 'waarheidsvriend-content-db'
user_name: 'Joost'
date: '2026-01-29'
lastStep: 8
status: 'complete'
completedAt: '2026-01-29'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
40 requirements verdeeld over 6 domeinen. Content Parsing (17 FRs) vormt de kern — hier zit de meeste complexiteit. Upload, Review, API en Data Management zijn ondersteunend.

**Non-Functional Requirements:**
- **Performance:** Parser <2 min voor 15 artikelen, UI responses <500ms
- **Security:** Minimaal (localhost of basic auth), credentials in env vars
- **Integration:** RESTful JSON API compatibel met WordPress
- **Reliability:** Parser-fouten isoleren per artikel, niet hele verwerking stoppen

**Scale & Complexity:**
- Primary domain: Internal web application (Next.js SPA)
- Complexity level: Medium
- Estimated architectural components: 5-6 (Parser, PDF Processor, Database, API, Review UI, File Storage)

### Technical Constraints & Dependencies

- **Input format:** InDesign XHTML-export met specifieke mapstructuur
- **Output target:** WordPress REST API consumptie
- **Runtime:** Docker Compose (Next.js + PostgreSQL)
- **Browser:** Moderne browsers only, geen legacy support
- **Skip:** SEO, WebSockets, WCAG, offline support

### Cross-Cutting Concerns Identified

1. **Error Handling:** Graceful degradation bij parser-fouten
2. **File Management:** Upload, opslag en serving van images en PDFs
3. **Logging:** Parser-fouten traceerbaar voor debugging
4. **Database Access:** Consistent pattern voor alle componenten

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web applicatie (interne tool) gebaseerd op Next.js met App Router.

### Starter Options Considered

| Starter | Kenmerken | Geschiktheid |
|---------|-----------|--------------|
| **create-next-app (officieel)** | Clean, minimaal, up-to-date, flexibel | ⭐ Beste fit |
| ixartz/Next-js-Boilerplate | Zeer uitgebreid (Clerk, Drizzle, Sentry, i18n, Storybook) | Te veel overhead |
| Skolaczk/next-starter | Auth, Stripe, testing tools | Overkill voor single-user |
| bonabrian/snxtw | Minimaal App Router template | Vergelijkbaar met officieel |

### Selected Starter: create-next-app (Officieel)

**Rationale for Selection:**
1. **Minimaal maar compleet** — Geen onnodige dependencies voor een interne tool
2. **Up-to-date** — Altijd de laatste Next.js versie
3. **Flexibel** — Geen opgedrongen patterns die niet passen
4. **Eenvoudig** — Single-user app heeft geen Clerk, Stripe, i18n nodig

**Initialization Command:**

```bash
npx create-next-app@latest waarheidsvriend-content-db --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"
```

### Architectural Decisions Provided by Starter

| Aspect | Beslissing |
|--------|------------|
| **Language & Runtime** | TypeScript |
| **Styling Solution** | Tailwind CSS |
| **Routing** | App Router |
| **Project Structure** | `src/` directory |
| **Code Quality** | ESLint |
| **Development Server** | Turbopack |
| **Import Alias** | `@/*` |

### Decisions Still Required

- Database setup (PostgreSQL + ORM keuze)
- API route structuur
- Component library
- Testing framework
- Docker configuratie

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database ORM: Prisma
- API Authentication: API Key
- UI Authentication: NextAuth.js

**Important Decisions (Shape Architecture):**
- Component Library: shadcn/ui
- State Management: React Query
- File Storage: Local filesystem
- PDF Processing: Poppler

**Deferred Decisions (Post-MVP):**
- Caching strategy (indien performance issues)
- Rate limiting (indien nodig)

### Data Architecture

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| ORM | Prisma | Industriestandaard, uitstekende TypeScript support, declaratief schema |
| Database | PostgreSQL | Uit PRD, betrouwbaar, goede JSON support |
| Migrations | Prisma Migrate | Geïntegreerd met Prisma |

### Authentication & Security

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| API Auth | API Key (`X-API-Key` header) | Simpel, veilig genoeg voor single consumer (WordPress) |
| UI Auth | NextAuth.js (Credentials) | Nette login pagina, standaard voor Next.js |
| Secrets | Environment variables | Geen credentials in code |

### API & Communication Patterns

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| API Style | REST met versie prefix | WordPress compatibel, `/api/v1/` |
| Response Format | Consistente JSON | `{ success, data/error }` |
| Error Handling | Gestructureerde error codes | Debugbaar, consistente foutafhandeling |

**API Routes:**
- `/api/v1/editions` — Lijst/details edities
- `/api/v1/editions/[id]/articles` — Artikelen per editie
- `/api/v1/articles/[id]` — Artikel details
- `/api/v1/authors` — Auteurs met foto's

### Frontend Architecture

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| Component Library | shadcn/ui | Tailwind-based, copy-paste, geen lock-in |
| Server State | React Query | Caching, refetching, loading states |
| Client State | useState | Simpel genoeg, geen extra library nodig |

### Infrastructure & Deployment

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| Runtime | Docker Compose | Next.js + PostgreSQL containers |
| File Storage | Lokaal filesystem (volume) | Simpel, voldoende voor single-user |
| PDF Processing | Poppler (pdftoppm) | Betrouwbaar, in Docker container |

**Docker Compose structuur:**
```yaml
services:
  app:     # Next.js
  db:      # PostgreSQL
volumes:
  db_data: # Database persistentie
  uploads: # Bestanden (XHTML, PDF, images)
```

### Decision Impact Analysis

**Implementation Sequence:**
1. Docker Compose + PostgreSQL setup
2. Prisma schema + migrations
3. NextAuth.js configuratie
4. API routes met API Key middleware
5. shadcn/ui componenten
6. React Query integratie

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Prisma):**

| Aspect | Conventie | Voorbeeld |
|--------|-----------|-----------|
| Tables | snake_case, meervoud | `editions`, `articles`, `authors` |
| Columns | snake_case | `created_at`, `edition_id`, `page_number` |
| Prisma Models | PascalCase | `Edition`, `Article`, `Author` |
| Foreign Keys | `[table]_id` | `edition_id`, `author_id` |

**API:**

| Aspect | Conventie | Voorbeeld |
|--------|-----------|-----------|
| Endpoints | kebab-case, meervoud | `/api/v1/editions`, `/api/v1/articles` |
| Route params | `[id]` | `/api/v1/editions/[id]` |
| Query params | camelCase | `?editionId=5&includeAuthors=true` |
| Headers | `X-` prefix voor custom | `X-API-Key` |

**Code:**

| Aspect | Conventie | Voorbeeld |
|--------|-----------|-----------|
| Components | PascalCase | `ArticleCard.tsx`, `EditionList.tsx` |
| Hooks | camelCase met `use` prefix | `useArticles.ts`, `useEdition.ts` |
| Utilities | camelCase | `parseXhtml.ts`, `convertPdf.ts` |
| Types/Interfaces | PascalCase | `Article`, `EditionWithArticles` |
| Constants | SCREAMING_SNAKE_CASE | `API_BASE_URL`, `MAX_FILE_SIZE` |

### Structure Patterns

**Project Organization:**

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/v1/            # API routes
│   │   ├── editions/
│   │   ├── articles/
│   │   └── authors/
│   ├── (auth)/            # Auth-protected routes (layout group)
│   │   ├── editions/
│   │   └── review/
│   └── login/             # Public routes
├── components/
│   ├── ui/                # shadcn/ui componenten
│   └── [feature]/         # Feature-specifieke componenten
├── lib/
│   ├── db.ts              # Prisma client singleton
│   ├── auth.ts            # NextAuth config
│   ├── api-response.ts    # Response helpers
│   └── api-key.ts         # API key validation
├── services/
│   ├── parser/            # XHTML parser logic
│   │   ├── index.ts
│   │   ├── article-extractor.ts
│   │   └── image-mapper.ts
│   └── pdf/               # PDF processing
│       └── converter.ts
├── hooks/                 # Custom React hooks
└── types/                 # Shared TypeScript types
    └── index.ts
```

**Test Files:** Co-located met bronbestand
- `ArticleCard.tsx` → `ArticleCard.test.tsx`
- `parseXhtml.ts` → `parseXhtml.test.ts`

### Format Patterns

**API Responses:**

```typescript
// Success (single item)
{
  success: true,
  data: { id: 1, title: "..." }
}

// Success (list)
{
  success: true,
  data: [...],
  meta: { total: 15, page: 1, pageSize: 10 }
}

// Error
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Article not found"
  }
}
```

**Error Codes:**
- `NOT_FOUND` — Resource bestaat niet
- `VALIDATION_ERROR` — Input validatie gefaald
- `UNAUTHORIZED` — Geen of ongeldige API key
- `PARSE_ERROR` — Parser kon content niet verwerken
- `INTERNAL_ERROR` — Onverwachte serverfout

**Data Formats:**
- Dates: ISO 8601 strings (`"2026-01-29T10:30:00Z"`)
- JSON fields: camelCase in responses
- IDs: integers (database) of strings in URLs

### Process Patterns

**Error Handling:**

```typescript
// API routes
try {
  // ... logic
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('[API] Error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: '...' } },
    { status: 500 }
  );
}

// Parser - per-artikel isolation
for (const rawArticle of rawArticles) {
  try {
    articles.push(parseArticle(rawArticle));
  } catch (error) {
    errors.push({ article: rawArticle.id, error: error.message });
    // Continue met volgende artikel
  }
}
```

**Loading States:**
- React Query `isLoading` voor initial load
- React Query `isFetching` voor background refetch
- Skeleton loaders via shadcn/ui

### Enforcement Guidelines

**AI Agents MUST:**
- Volg naamgevingsconventies exact zoals gedocumenteerd
- Plaats bestanden in de correcte directory volgens structuur
- Gebruik de gedefinieerde API response format
- Implementeer error handling volgens het process pattern
- Co-locate tests met bronbestanden

**Anti-Patterns (NIET doen):**
- ❌ `Users` tabel (moet `users` zijn)
- ❌ `getUserById` endpoint (moet `/api/v1/users/[id]` zijn)
- ❌ Tests in aparte `__tests__/` folder
- ❌ Direct error messages naar client zonder gestructureerde format
- ❌ `any` types in TypeScript

## Project Structure & Boundaries

### Complete Project Directory Structure

```
waarheidsvriend-content-db/
├── README.md
├── package.json
├── package-lock.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── components.json              # shadcn/ui config
├── .env.example
├── .env.local                   # Lokale secrets (gitignored)
├── .gitignore
├── .eslintrc.json
├── docker-compose.yml
├── Dockerfile
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Prisma migrations
│   └── seed.ts                  # Database seeding
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Homepage (redirect)
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx         # Login pagina
│   │   │
│   │   ├── (auth)/              # Auth-protected layout group
│   │   │   ├── layout.tsx       # Auth check wrapper
│   │   │   │
│   │   │   ├── editions/
│   │   │   │   ├── page.tsx              # Editie lijst
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx          # Editie detail
│   │   │   │   └── upload/
│   │   │   │       └── page.tsx          # Upload interface
│   │   │   │
│   │   │   └── review/
│   │   │       └── [editionId]/
│   │   │           └── page.tsx          # Review split-view
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts          # NextAuth handler
│   │       │
│   │       ├── upload/
│   │       │   └── route.ts              # File upload endpoint
│   │       │
│   │       └── v1/
│   │           ├── editions/
│   │           │   ├── route.ts          # GET/POST /editions
│   │           │   └── [id]/
│   │           │       ├── route.ts      # GET /editions/:id
│   │           │       └── articles/
│   │           │           └── route.ts  # GET /editions/:id/articles
│   │           │
│   │           ├── articles/
│   │           │   └── [id]/
│   │           │       └── route.ts      # GET /articles/:id
│   │           │
│   │           └── authors/
│   │               ├── route.ts          # GET /authors
│   │               └── [id]/
│   │                   └── route.ts      # GET /authors/:id
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn/ui componenten
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── editions/
│   │   │   ├── EditionCard.tsx
│   │   │   ├── EditionList.tsx
│   │   │   └── UploadForm.tsx
│   │   │
│   │   ├── review/
│   │   │   ├── ArticleView.tsx
│   │   │   ├── PdfSpreadView.tsx
│   │   │   ├── SplitView.tsx
│   │   │   └── ArticleNavigation.tsx
│   │   │
│   │   └── shared/
│   │       ├── Header.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorMessage.tsx
│   │
│   ├── lib/
│   │   ├── db.ts                         # Prisma client singleton
│   │   ├── auth.ts                       # NextAuth config
│   │   ├── api-response.ts               # Response helpers
│   │   ├── api-key.ts                    # API key validation
│   │   └── utils.ts                      # General utilities
│   │
│   ├── services/
│   │   ├── parser/
│   │   │   ├── index.ts                  # Parser orchestration
│   │   │   ├── xhtml-loader.ts           # Load XHTML files
│   │   │   ├── article-extractor.ts      # Extract articles
│   │   │   ├── author-extractor.ts       # Extract authors
│   │   │   ├── image-mapper.ts           # Map images to articles
│   │   │   └── structure-analyzer.ts     # Analyze CSS/structure
│   │   │
│   │   └── pdf/
│   │       ├── index.ts                  # PDF service entry
│   │       └── converter.ts              # PDF to images (Poppler)
│   │
│   ├── hooks/
│   │   ├── useEditions.ts
│   │   ├── useArticles.ts
│   │   └── useUpload.ts
│   │
│   ├── types/
│   │   └── index.ts                      # Shared TypeScript types
│   │
│   └── middleware.ts                     # NextAuth middleware
│
├── uploads/                              # Docker volume mount
│   ├── editions/
│   │   └── [edition-id]/
│   │       ├── xhtml/                    # Originele XHTML export
│   │       ├── pdf/                      # Originele PDF
│   │       └── images/                   # Geëxtraheerde images
│   └── .gitkeep
│
└── public/
    └── favicon.ico
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Consumer | Auth Method |
|----------|----------|-------------|
| `/api/v1/*` | WordPress | API Key (`X-API-Key`) |
| `/api/upload/*` | Review UI | NextAuth session |
| `/api/auth/*` | Login UI | Public (credentials) |

**Component Boundaries:**

| Layer | Verantwoordelijkheid | Communicatie |
|-------|---------------------|--------------|
| `app/` pages | Routing, layout | → components, hooks |
| `components/` | UI rendering | → hooks voor data |
| `hooks/` | Data fetching (React Query) | → API routes |
| `services/` | Business logic | → lib (db, utils) |
| `lib/` | Infrastructure | → external (Prisma, fs) |

**Data Boundaries:**

| Data Type | Opslag | Access Pattern |
|-----------|--------|----------------|
| Structured data | PostgreSQL | Prisma ORM |
| Files (XHTML, PDF) | Filesystem (`uploads/`) | Node.js fs |
| Images | Filesystem + DB reference | URL in database |
| Sessions | NextAuth (JWT/cookie) | Middleware |

### Requirements to Structure Mapping

| FR Categorie | Primaire Locatie | Secundaire Bestanden |
|--------------|------------------|---------------------|
| **Editie Upload (FR1-4)** | `src/app/(auth)/editions/upload/` | `src/components/editions/UploadForm.tsx`, `src/app/api/upload/` |
| **Content Parsing (FR5-21)** | `src/services/parser/` | `prisma/schema.prisma` |
| **PDF Verwerking (FR22-24)** | `src/services/pdf/` | `uploads/editions/[id]/images/` |
| **Review Interface (FR25-29)** | `src/app/(auth)/review/` | `src/components/review/*` |
| **Content API (FR30-34)** | `src/app/api/v1/` | `src/lib/api-response.ts` |
| **Data Management (FR35-40)** | `prisma/schema.prisma` | `src/lib/db.ts` |

### Integration Points

**Internal Data Flow:**
```
Upload → Parser Service → Database → API → WordPress
                ↓
         PDF Service → Images → Filesystem
```

**External Integrations:**

| Integration | Type | Endpoint |
|-------------|------|----------|
| WordPress | Outbound API consumer | `/api/v1/*` |
| PostgreSQL | Database | `DATABASE_URL` env var |
| Filesystem | File storage | `uploads/` volume |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
Alle technologiekeuzes werken naadloos samen:
- Next.js + Prisma: Gangbare, bewezen combinatie
- TypeScript + shadcn/ui: Volledig compatible
- React Query + App Router: Complementaire data-fetching strategie
- NextAuth + API Key: Gescheiden auth voor UI vs externe API
- Docker + PostgreSQL + Poppler: Alle services containerized

**Pattern Consistency:**
- Naamconventies consistent over database, API, en code
- Structuurpatronen logisch gescheiden per concern
- Error handling uniform geïmplementeerd

**Structure Alignment:**
- Projectstructuur ondersteunt alle architectuurbeslissingen
- Boundaries duidelijk gedefinieerd tussen layers
- Integration points correct gestructureerd

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR Categorie | Status | Gedekt Door |
|--------------|--------|-------------|
| Editie Upload (FR1-4) | ✅ | Upload API + UploadForm component |
| Content Parsing (FR5-21) | ✅ | Parser services |
| PDF Verwerking (FR22-24) | ✅ | PDF service + Poppler |
| Review Interface (FR25-29) | ✅ | Review pages + components |
| Content API (FR30-34) | ✅ | REST API routes |
| Data Management (FR35-40) | ✅ | Prisma schema |

**Non-Functional Requirements Coverage:**

| NFR | Status | Gedekt Door |
|-----|--------|-------------|
| Performance (NFR1-4) | ✅ | React Query caching, Turbopack |
| Security (NFR5-6) | ✅ | API Key + NextAuth + env vars |
| Integration (NFR7-9) | ✅ | REST/JSON API standaard |
| Reliability (NFR10-11) | ✅ | Per-artikel error isolation |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- ✅ Alle kritieke beslissingen gedocumenteerd
- ✅ Technologie-versies gespecificeerd
- ✅ Concrete code voorbeelden gegeven

**Structure Completeness:**
- ✅ Volledige directory tree gedefinieerd
- ✅ Alle bestanden en directories benoemd
- ✅ Component boundaries gespecificeerd

**Pattern Completeness:**
- ✅ Naamconventies voor alle areas
- ✅ API response formats gedocumenteerd
- ✅ Error handling patterns met voorbeelden
- ✅ Anti-patterns geïdentificeerd

### Gap Analysis Results

**Critical Gaps:** Geen

**Minor Gaps (niet-blokkerend):**
- Testing framework (Vitest/Jest) kan later gekozen worden
- Logging library kan `console.log` blijven voor MVP

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context grondig geanalyseerd
- [x] Scale en complexiteit beoordeeld
- [x] Technische constraints geïdentificeerd
- [x] Cross-cutting concerns gemapt

**✅ Architectural Decisions**
- [x] Kritieke beslissingen gedocumenteerd
- [x] Technologie stack volledig gespecificeerd
- [x] Integratie patterns gedefinieerd
- [x] Performance overwegingen geadresseerd

**✅ Implementation Patterns**
- [x] Naamconventies vastgesteld
- [x] Structuurpatronen gedefinieerd
- [x] Communicatiepatronen gespecificeerd
- [x] Procespatronen gedocumenteerd

**✅ Project Structure**
- [x] Complete directory structuur gedefinieerd
- [x] Component boundaries vastgesteld
- [x] Integration points gemapt
- [x] Requirements-to-structure mapping compleet

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- Bewezen, gangbare technologie stack
- Duidelijke scheiding van concerns
- Concrete voorbeelden voor alle patterns
- Volledige requirements coverage

**Areas for Future Enhancement:**
- Testing strategie verfijnen na MVP
- Monitoring/logging uitbreiden indien nodig
- Performance optimalisatie na real-world gebruik

### Implementation Handoff

**AI Agent Guidelines:**
- Volg alle architectuurbeslissingen exact zoals gedocumenteerd
- Gebruik implementatiepatronen consistent over alle componenten
- Respecteer projectstructuur en boundaries
- Raadpleeg dit document voor alle architectuurvragen

**First Implementation Priority:**
```bash
npx create-next-app@latest waarheidsvriend-content-db --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"
```

