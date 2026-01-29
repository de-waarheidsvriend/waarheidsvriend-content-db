# Story 1.3: Database Schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Als developer,
Wil ik een Prisma schema hebben met alle benodigde tabellen,
Zodat content data gestructureerd kan worden opgeslagen.

## Acceptance Criteria

1. **Given** Docker Compose met PostgreSQL draait
   **When** `npx prisma migrate dev` wordt uitgevoerd
   **Then** worden de volgende tabellen aangemaakt:

   | Tabel | Beschrijving | Key Fields |
   |-------|--------------|------------|
   | `editions` | Edities met metadata (FR35) | id, edition_number, edition_date, created_at |
   | `articles` | Artikelen gekoppeld aan editie (FR36) | id, edition_id, title, chapeau, content, excerpt, category, page_start, page_end |
   | `authors` | Auteurs met profielen (FR37) | id, name, photo_url |
   | `article_authors` | Artikel-auteur relaties (FR38) | article_id, author_id |
   | `images` | Afbeeldingen met metadata (FR39) | id, article_id, url, caption, is_featured |
   | `page_images` | Pagina-afbeeldingen per editie (FR40) | id, edition_id, page_number, image_url |

2. **And** zijn er foreign key constraints tussen gerelateerde tabellen

3. **And** is er een `src/lib/db.ts` met Prisma client singleton

4. **And** volgen alle tabelnamen snake_case conventie

## Tasks / Subtasks

- [x] Task 1: Prisma initialiseren (AC: #1, #4)
  - [x] 1.1 Installeer Prisma als dev dependency: `npm install prisma --save-dev`
  - [x] 1.2 Installeer Prisma Client: `npm install @prisma/client`
  - [x] 1.3 Initialiseer Prisma: `npx prisma init` (maakt `prisma/` folder en schema.prisma)
  - [x] 1.4 Configureer datasource in schema.prisma voor PostgreSQL met `DATABASE_URL` env var

- [x] Task 2: Database schema definiëren (AC: #1, #2, #4)
  - [x] 2.1 Maak `Edition` model met: id (Int, autoincrement), edition_number (Int, unique), edition_date (DateTime), status (String), created_at (DateTime), updated_at (DateTime)
  - [x] 2.2 Maak `Article` model met: id, edition_id (FK), title, chapeau, content (Text), excerpt, category, page_start (Int), page_end (Int), created_at, updated_at
  - [x] 2.3 Maak `Author` model met: id, name (String, unique), photo_url (String, optional)
  - [x] 2.4 Maak `ArticleAuthor` join-tabel met: article_id (FK), author_id (FK), composite primary key
  - [x] 2.5 Maak `Image` model met: id, article_id (FK), url, caption (optional), is_featured (Boolean, default false), sort_order (Int)
  - [x] 2.6 Maak `PageImage` model met: id, edition_id (FK), page_number (Int), image_url

- [x] Task 3: Relaties en constraints (AC: #2)
  - [x] 3.1 Definieer Edition → Article relatie (one-to-many, cascade delete)
  - [x] 3.2 Definieer Article ↔ Author many-to-many via ArticleAuthor
  - [x] 3.3 Definieer Article → Image relatie (one-to-many, cascade delete)
  - [x] 3.4 Definieer Edition → PageImage relatie (one-to-many, cascade delete)
  - [x] 3.5 Voeg unique constraint toe: PageImage (edition_id, page_number)

- [x] Task 4: Prisma Client singleton (AC: #3)
  - [x] 4.1 Maak `src/lib/` directory
  - [x] 4.2 Maak `src/lib/db.ts` met Prisma client singleton pattern (voorkom multiple instances in dev)
  - [x] 4.3 Exporteer getypeerde Prisma client voor gebruik in services

- [x] Task 5: Migratie uitvoeren en valideren (AC: #1)
  - [x] 5.1 Voer `npx prisma migrate dev --name init` uit om eerste migratie te maken
  - [x] 5.2 Verifieer dat alle tabellen zijn aangemaakt in PostgreSQL
  - [x] 5.3 Voer `npx prisma generate` uit om Prisma Client types te genereren

## Dev Notes

### Prisma Schema Conventies

Uit Architecture.md - naamgevingsconventies voor database:

| Aspect | Conventie | Voorbeeld |
|--------|-----------|-----------|
| Tables | snake_case, meervoud | `editions`, `articles`, `authors` |
| Columns | snake_case | `created_at`, `edition_id`, `page_number` |
| Prisma Models | PascalCase | `Edition`, `Article`, `Author` |
| Foreign Keys | `[table]_id` | `edition_id`, `author_id` |

**KRITIEK:** Gebruik `@@map("tablename")` in Prisma om snake_case tabelnamen te forceren terwijl models PascalCase blijven.

### Database Schema Design

Gebaseerd op PRD FRs en Architecture.md:

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  editions   │       │  articles   │       │   authors   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │   ┌──│ id (PK)     │
│ edition_num │  │    │ edition_id  │←──┘  │ name        │
│ edition_date│  │    │ title       │      │ photo_url   │
│ status      │  │    │ chapeau     │      └─────────────┘
│ created_at  │  │    │ content     │             ▲
│ updated_at  │  │    │ excerpt     │             │
└─────────────┘  │    │ category    │    ┌────────┴────────┐
       │         │    │ page_start  │    │ article_authors │
       │         │    │ page_end    │    ├─────────────────┤
       │         │    │ created_at  │    │ article_id (FK) │
       │         │    │ updated_at  │    │ author_id (FK)  │
       │         └───→│             │←───┤                 │
       │              └─────────────┘    └─────────────────┘
       │                     │
       │                     ▼
       │              ┌─────────────┐
       │              │   images    │
       │              ├─────────────┤
       │              │ id (PK)     │
       │              │ article_id  │
       │              │ url         │
       │              │ caption     │
       │              │ is_featured │
       │              │ sort_order  │
       │              └─────────────┘
       │
       ▼
┌─────────────┐
│ page_images │
├─────────────┤
│ id (PK)     │
│ edition_id  │
│ page_number │
│ image_url   │
└─────────────┘
```

### Edition Status Values

Uit de verwerkingspipeline (Epic 2):
- `pending` - Upload voltooid, verwerking niet gestart
- `processing` - Verwerking bezig
- `completed` - Succesvol verwerkt
- `completed_with_errors` - Verwerkt met parse-fouten (NFR10)
- `failed` - Verwerking mislukt

### Prisma Client Singleton Pattern

Uit Architecture.md - voorkom multiple Prisma instances in development mode:

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Content Field Types

| Field | Prisma Type | Reden |
|-------|-------------|-------|
| content | String (geen @db.Text) | Prisma 5+ default is unlimited text voor String |
| chapeau | String? | Korte intro-tekst, nullable |
| excerpt | String? | Artikel-samenvatting, nullable |
| photo_url | String? | Auteursfoto pad, nullable |
| caption | String? | Afbeeldingsonderschrift, nullable |

### Previous Story Intelligence

Story 1.2 (Docker Compose Setup) heeft het volgende fundament gelegd:
- **docker-compose.yml** met PostgreSQL service (`db`) op poort 5432
- **DATABASE_URL** in `.env.example`: `postgresql://postgres:postgres@db:5432/waarheidsvriend`
- **db_data** volume voor persistentie
- PostgreSQL 16 als database versie
- Healthcheck geconfigureerd voor database readiness

**Belangrijke context voor migraties:**
- Database draait in Docker container, bereikbaar via `db:5432` vanuit app container
- Of via `localhost:5432` vanuit host machine
- Credentials: `postgres:postgres` (development only)

### Git Intelligence

Recente commits tonen de projectvoortgang:
- `feat(docker)` - Docker Compose setup gereed
- `feat(init)` - Next.js 16 project geïnitialiseerd
- Project volgt conventional commits pattern

Geen Prisma-gerelateerde commits nog - dit is de eerste database story.

### Project Structure Notes

Nieuwe bestanden aan te maken:
- `prisma/schema.prisma` - Database schema
- `prisma/migrations/` - Migratie bestanden (auto-gegenereerd)
- `src/lib/db.ts` - Prisma client singleton

De `src/lib/` directory bestaat nog niet en moet worden aangemaakt.

**Alignment met Architecture.md:**
```
src/
├── lib/
│   ├── db.ts              # Prisma client singleton  ← NIEUW
│   ├── auth.ts            # NextAuth config (Story 1.4)
│   └── ...
```

### Latest Tech Information

**Prisma 6.x (2025/2026 versie):**
- Prisma Client en CLI moeten dezelfde major versie hebben
- `@prisma/client` en `prisma` altijd samen updaten
- TypeScript 5.x ondersteuning volledig
- Native ESM support in Next.js 16 compatibel

**PostgreSQL 16 (LTS):**
- JSONB type ondersteund voor eventuele structured content blocks
- Cascade delete werkt via `onDelete: Cascade` in Prisma

### Performance Overwegingen

- Indexes automatisch op primary keys en foreign keys
- Overweeg index op `articles.category` voor filtering (kan later)
- Overweeg index op `editions.edition_date` voor sortering (kan later)

### References

- [Source: architecture.md#Data Architecture] - ORM: Prisma, Database: PostgreSQL
- [Source: architecture.md#Naming Patterns] - Database naamconventies
- [Source: architecture.md#Complete Project Directory Structure] - src/lib/db.ts locatie
- [Source: epics.md#Story 1.3] - Acceptance Criteria en tabelstructuur
- [Source: prd.md#Data Management] - FR35-FR40 requirements
- [Source: 1-2-docker-compose-setup.md] - DATABASE_URL configuratie

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Prisma 7.3.0 vereist `@prisma/adapter-pg` driver adapter pattern (breuk met eerdere versies)
- Gebruik `prisma-client-js` generator i.p.v. nieuwe `prisma-client` generator voor compatibiliteit
- DATABASE_URL in .env gewijzigd van `db:5432` naar `localhost:5432` voor host machine toegang

### Completion Notes List

- ✅ Prisma 7.3.0 geïnstalleerd en geïnitialiseerd
- ✅ Volledig database schema gedefinieerd met alle 6 tabellen (editions, articles, authors, article_authors, images, page_images)
- ✅ Foreign key constraints met cascade delete op alle relaties
- ✅ Snake_case tabelnamen via @@map() directive
- ✅ Prisma client singleton patroon in src/lib/db.ts met PrismaPg adapter
- ✅ Initiële migratie uitgevoerd en alle tabellen geverifieerd in PostgreSQL
- ✅ 21 unit tests geschreven en allemaal succesvol (schema validatie, CRUD, relaties, cascade delete, constraints)
- ✅ Vitest test framework geïnstalleerd en geconfigureerd
- ✅ Consistente timestamps (created_at, updated_at) op alle models

### File List

**New files:**
- prisma/schema.prisma
- prisma/migrations/20260129132215_init/migration.sql
- prisma/migrations/20260129133202_add_timestamps/migration.sql
- prisma.config.ts
- src/lib/db.ts
- src/lib/db.test.ts
- vitest.config.ts

**Modified files:**
- package.json (dependencies: prisma, @prisma/client, @prisma/adapter-pg, pg, vitest)
- package-lock.json
- .gitignore (added /src/generated/prisma)
- .env (DATABASE_URL gewijzigd naar localhost:5432)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-29 | Story implemented: Prisma schema, migratie, client singleton, tests | Claude Opus 4.5 |
| 2026-01-29 | Code Review: Fixed 7 issues - timestamps toegevoegd aan Author/Image/PageImage models, test file verplaatst naar co-located locatie, 3 extra cascade delete tests, vitest config verbeterd | Claude Opus 4.5 (Review) |
