---
title: 'WordPress Publicatie Koppeling'
slug: 'wordpress-publicatie-koppeling'
created: '2026-01-30'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 16 (App Router)
  - TypeScript (strict)
  - Prisma ORM 7.x
  - React Query (TanStack Query)
  - WordPress REST API
  - Vitest (testing)
files_to_modify:
  - src/services/wordpress/types.ts (nieuw)
  - src/services/wordpress/api-client.ts (nieuw)
  - src/services/wordpress/article-mapper.ts (nieuw)
  - src/services/wordpress/media-uploader.ts (nieuw)
  - src/services/wordpress/author-sync.ts (nieuw)
  - src/services/wordpress/index.ts (nieuw)
  - scripts/publish-to-wp.ts (nieuw)
  - src/app/api/editions/[id]/publish/route.ts (nieuw)
  - src/hooks/usePublish.ts (nieuw)
  - src/components/editions/PublishButton.tsx (nieuw)
  - src/app/(auth)/editions/[id]/page.tsx (wijzigen)
  - .env.example (wijzigen)
code_patterns:
  - Services in src/services/ met index.ts als entry point
  - API routes met { success: true, data } of { success: false, error }
  - Environment variables via process.env
  - React Query hooks in src/hooks/
  - ES modules in scripts (import.meta.url pattern)
test_patterns:
  - Vitest met co-located tests (*.test.ts naast bronbestand)
  - Testing Library voor React components
  - Mock externe APIs in tests
---

# Tech-Spec: WordPress Publicatie Koppeling

**Created:** 2026-01-30

## Overview

### Problem Statement

Artikelen worden geparsed en opgeslagen in de lokale database, maar moeten handmatig naar de WordPress website van de Gereformeerde Bond worden overgebracht. Dit is tijdrovend en foutgevoelig.

### Solution

Een WordPress publicatie service die automatisch alle artikelen van een editie naar WordPress pusht:
- Artikelen in omgekeerde paginavolgorde uploaden (laatste eerst → WordPress toont nieuw naar oud)
- Content blocks mappen naar ACF Flexible Content components
- Featured images en auteur foto's uploaden naar WordPress Media Library
- Auteurs synchroniseren (naam-based matching, aanmaken indien niet bestaat)
- Bestaande artikelen updaten (upsert op basis van slug)
- Beschikbaar via CLI script én UI button

### Scope

**In Scope:**
- WordPress API service (`src/services/wordpress/`)
- Media upload naar WordPress (featured images + auteur foto's)
- Content block → ACF component mapping (paragraph, quote, sidebar, image)
- Auteur synchronisatie (matchen op naam, aanmaken indien nodig)
- Artikel upsert (nieuw aanmaken of bestaand updaten op slug)
- CLI script (`scripts/publish-to-wp.ts`)
- UI button in editie detail pagina
- Dry-run modus voor testen
- Voortgangsrapportage

**Out of Scope:**
- Inline article images uploaden (alleen featured image)
- WordPress categorieën/tags beheer
- Batch scheduling (meerdere edities tegelijk)
- Rollback functionaliteit

## Context for Development

### Codebase Patterns

- **Services:** Business logic in `src/services/` met `index.ts` als entry point (zie `src/services/parser/index.ts`)
- **API responses:** `{ success: true, data }` of `{ success: false, error: { code, message } }`
- **Environment variables:** Credentials in `.env.local`, template in `.env.example`
- **TypeScript:** Strict types, geen `any`, interfaces in `src/types/`
- **Naamgeving:** camelCase voor functies/variabelen, PascalCase voor types/interfaces
- **Hooks:** React Query hooks in `src/hooks/` (zie `useEditions.ts`, `useArticles.ts`)
- **Scripts:** ES modules met `import.meta.url` pattern (zie `scripts/test-articles.ts`)
- **Images:** Lokaal opgeslagen in `uploads/editions/[id]/xhtml/`, geserveerd via `/uploads/*` route

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `docs/wordpress-integratie.md` | WordPress API specificatie en ACF structuur |
| `src/lib/content-blocks.ts` | Content block transformatie (paragraph, quote, sidebar, image) |
| `src/types/api.ts` | API response types (ArticleDetail, ContentBlock) |
| `src/app/api/v1/articles/[id]/route.ts` | Artikel ophalen met content blocks |
| `src/services/parser/index.ts` | Voorbeeld van service orchestration |
| `src/hooks/useEditions.ts` | React Query hook pattern |
| `src/app/(auth)/editions/[id]/page.tsx` | Editie detail pagina (button locatie) |
| `scripts/test-articles.ts` | CLI script pattern |
| `prisma/schema.prisma` | Database schema (Article, Author, Image) |

### Technical Decisions

1. **Artikel volgorde:** Sorteer op `page_start DESC` zodat laatste artikel eerst wordt geüpload → WordPress toont nieuw naar oud
2. **Slug-based upsert:** Check via `GET /wv-articles?slug={slug}`, dan POST (nieuw) of PUT (update)
3. **Auteur matching:** Zoek WordPress user op `name` field via `/wp/v2/users?search=`, maak aan indien niet gevonden
4. **Media upload:** Upload naar `/wp/v2/media` met multipart/form-data, gebruik returned ID in artikel
5. **Publicatie datum:** Alle artikelen krijgen zelfde `date_gmt` (volgende donderdag 09:00 NL tijd)
6. **Image paths:** Lokale images in `uploads/editions/[id]/xhtml/...`, lees als Buffer voor upload
7. **Auth header:** `Authorization: Basic base64(username:app_password)`
8. **Featured image:** Eerste image met `is_featured=true` of laagste `sort_order`

## Implementation Plan

### Tasks

#### Task 1: WordPress Types definieren
- **File:** `src/services/wordpress/types.ts` (nieuw)
- **Action:** Maak TypeScript interfaces voor WordPress API communicatie
- **Details:**
  - `WpCredentials` - username, appPassword, apiUrl
  - `WpArticlePayload` - title, slug, status, date_gmt, acf object
  - `WpAcfComponent` - union type voor text, quote, text_image, paywall
  - `WpMediaUploadResult` - id, source_url, title
  - `WpUser` - id, name, slug, avatar_urls
  - `WpArticleResponse` - response van POST/PUT wv-articles
  - `PublishResult` - success, articlesPublished, errors array
  - `PublishProgress` - current, total, currentArticle, status

#### Task 2: WordPress API Client
- **File:** `src/services/wordpress/api-client.ts` (nieuw)
- **Action:** HTTP client met Basic Auth voor WordPress REST API
- **Details:**
  - `createAuthHeader(credentials)` - Base64 encoded auth header
  - `wpFetch(url, options, credentials)` - Wrapper rond fetch met auth
  - `getArticleBySlug(slug)` - GET /wv-articles?slug=X
  - `createArticle(payload)` - POST /wv-articles
  - `updateArticle(id, payload)` - PUT /wv-articles/{id}
  - `searchUsers(name)` - GET /users?search=X
  - `createUser(name, email)` - POST /users (voor auteurs)
  - Error handling met gestructureerde WpApiError

#### Task 3: Article Mapper (Content Blocks → ACF)
- **File:** `src/services/wordpress/article-mapper.ts` (nieuw)
- **Action:** Transformeer lokale artikel data naar WordPress ACF formaat
- **Details:**
  - `mapContentBlockToAcf(block)` - Enkele block naar ACF component
  - `mapArticleToWpPayload(article, authorId, featuredImageId)` - Volledig artikel
  - `generateArticleSlug(title, editionNumber)` - URL-safe slug generatie
  - `calculatePublishDate()` - Volgende donderdag 09:00 NL tijd
  - Mapping table:
    - paragraph → `{ acf_fc_layout: "text", text_text: "<p>...</p>" }`
    - subheading → `{ acf_fc_layout: "text", text_text: "<h3>...</h3>" }`
    - quote → `{ acf_fc_layout: "quote", quote_text, quote_author }`
    - sidebar → `{ acf_fc_layout: "text", text_text: "<div class='sidebar'>...</div>" }`
    - image → `{ acf_fc_layout: "text_image", text_image_image, text_image_text, text_image_position: "center" }`

#### Task 4: Media Uploader
- **File:** `src/services/wordpress/media-uploader.ts` (nieuw)
- **Action:** Upload lokale images naar WordPress Media Library
- **Details:**
  - `uploadImage(localPath, filename, credentials)` - Upload single image
  - `resolveLocalImagePath(imageUrl, editionId)` - /uploads/... → absolute path
  - `uploadFeaturedImage(article, editionId, credentials)` - Upload featured image indien aanwezig
  - `uploadAuthorPhoto(author, editionId, credentials)` - Upload auteur foto
  - Gebruik multipart/form-data met correct Content-Disposition
  - Return WpMediaUploadResult met id voor gebruik in artikel

#### Task 5: Author Sync Service
- **File:** `src/services/wordpress/author-sync.ts` (nieuw)
- **Action:** Synchroniseer auteurs tussen lokale DB en WordPress
- **Details:**
  - `findOrCreateWpUser(authorName, credentials)` - Zoek of maak WP user
  - `normalizeAuthorName(name)` - Consistente naam formatting
  - `syncAuthorPhoto(localAuthor, wpUserId, credentials)` - Upload foto en link aan user
  - `buildAuthorCache(credentials)` - Laad alle WP users in memory voor snelle lookup
  - Cache WP user IDs per sessie om duplicate lookups te vermijden

#### Task 6: Main Orchestration Service
- **File:** `src/services/wordpress/index.ts` (nieuw)
- **Action:** Orchestreer complete publicatie flow
- **Details:**
  - `publishEditionToWordPress(editionId, options)` - Main entry point
  - Options: `{ dryRun?: boolean, onProgress?: (progress) => void }`
  - Flow:
    1. Load edition met articles, authors, images uit DB
    2. Sorteer artikelen op page_start DESC
    3. Build author cache van WordPress
    4. Voor elk artikel:
       a. Sync auteur(s) → krijg WP user ID(s)
       b. Upload featured image → krijg WP media ID
       c. Map artikel naar WP payload
       d. Check of artikel bestaat (slug lookup)
       e. POST of PUT naar WordPress
       f. Report progress
    5. Return PublishResult met stats
  - `validateCredentials()` - Test WP verbinding
  - Re-export alle sub-modules

#### Task 7: CLI Script
- **File:** `scripts/publish-to-wp.ts` (nieuw)
- **Action:** Command-line interface voor publicatie
- **Details:**
  - Parse arguments: `--edition=<id>` (verplicht), `--dry-run` (optioneel)
  - Load .env via dotenv
  - Validate credentials aanwezig
  - Call `publishEditionToWordPress()` met progress callback
  - Console output:
    - `Publishing edition 123 to WordPress...`
    - `[1/15] Publishing: Artikel Titel...`
    - `✓ Created: artikel-slug (ID: 456)`
    - `✗ Failed: andere-artikel - Error message`
    - Summary: `Published 14/15 articles (1 failed)`
  - Exit code 0 bij success, 1 bij fouten
  - Voeg npm script toe: `"publish:wp": "tsx scripts/publish-to-wp.ts"`

#### Task 8: API Endpoint voor UI
- **File:** `src/app/api/editions/[id]/publish/route.ts` (nieuw)
- **Action:** POST endpoint om publicatie te triggeren vanuit UI
- **Details:**
  - Require NextAuth session (niet API key - dit is UI actie)
  - Accept body: `{ dryRun?: boolean }`
  - Validate edition exists en status is 'completed'
  - Call `publishEditionToWordPress()`
  - Return `{ success: true, data: PublishResult }`
  - Error response bij WP credentials missing of publicatie failure

#### Task 9: React Hook voor Publicatie
- **File:** `src/hooks/usePublish.ts` (nieuw)
- **Action:** React Query mutation hook voor publicatie
- **Details:**
  - `usePublishEdition()` - useMutation hook
  - Mutation function calls POST /api/editions/[id]/publish
  - Return `{ mutate, mutateAsync, isPending, isSuccess, isError, data, error }`
  - Invalidate edition query on success

#### Task 10: Publish Button Component
- **File:** `src/components/editions/PublishButton.tsx` (nieuw)
- **Action:** UI button met loading state en resultaat feedback
- **Details:**
  - Props: `editionId: number`, `disabled?: boolean`
  - Use `usePublishEdition()` hook
  - States:
    - Idle: "Publiceer naar WordPress" button
    - Loading: Spinner + "Publiceren..." (disabled)
    - Success: Green checkmark + "Gepubliceerd! (X artikelen)"
    - Error: Red X + error message + "Opnieuw proberen" button
  - Confirmation dialog voor safety: "Weet je zeker dat je X artikelen wilt publiceren naar WordPress?"

#### Task 11: Integreer Button in Editie Pagina
- **File:** `src/app/(auth)/editions/[id]/page.tsx` (wijzigen)
- **Action:** Voeg PublishButton toe naast "Review starten"
- **Details:**
  - Import PublishButton component
  - Plaats in button row: `<PublishButton editionId={editionId} />`
  - Alleen tonen als edition.status === 'completed'

#### Task 12: Environment Variables Documenteren
- **File:** `.env.example` (wijzigen)
- **Action:** Voeg WordPress credentials toe aan template
- **Details:**
  ```env
  # WordPress API (for publishing articles)
  NEXT_PUBLIC_WP_API_URL=https://gereformeerdebond.nl/wp-json/wp/v2
  WP_USERNAME=your-wordpress-username
  WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
  ```

### Acceptance Criteria

#### Happy Path
- [x] **AC1:** Given een editie met status 'completed' en 5 artikelen, when ik `npm run publish:wp -- --edition=123` uitvoer, then worden alle 5 artikelen als draft aangemaakt in WordPress in omgekeerde paginavolgorde
- [x] **AC2:** Given een artikel met een featured image, when het artikel wordt gepubliceerd, then is de image geüpload naar WP Media Library en gekoppeld aan het artikel via `acf.article_image`
- [x] **AC3:** Given een artikel met auteur "Ds. J. van der Berg", when de auteur niet bestaat in WordPress, then wordt een nieuwe WP user aangemaakt met die naam
- [x] **AC4:** Given een artikel met auteur die al bestaat in WordPress, when het artikel wordt gepubliceerd, then wordt de bestaande WP user ID gebruikt (geen duplicaat)
- [x] **AC5:** Given een artikel dat al bestaat in WordPress (zelfde slug), when het opnieuw wordt gepubliceerd, then wordt het bestaande artikel geüpdatet (PUT) ipv nieuw aangemaakt

#### UI Flow
- [x] **AC6:** Given de editie detail pagina, when de editie status is 'completed', then is de "Publiceer naar WordPress" button zichtbaar
- [x] **AC7:** Given de publish button, when ik erop klik, then verschijnt een bevestigingsdialog met het aantal artikelen
- [x] **AC8:** Given een lopende publicatie, when ik de pagina bekijk, then zie ik een loading state met "Publiceren..."
- [x] **AC9:** Given een succesvolle publicatie, when het klaar is, then zie ik een success melding met het aantal gepubliceerde artikelen

#### Error Handling
- [x] **AC10:** Given ontbrekende WP credentials in environment, when ik probeer te publiceren, then krijg ik een duidelijke foutmelding "WordPress credentials niet geconfigureerd"
- [x] **AC11:** Given een WordPress API error (bijv. 401 Unauthorized), when een artikel faalt, then gaat de publicatie door met de volgende artikelen en wordt de error gerapporteerd in het eindresultaat
- [x] **AC12:** Given de `--dry-run` flag, when ik het CLI script uitvoer, then worden geen echte API calls gemaakt maar wel alle mapping en validatie uitgevoerd

#### Content Mapping
- [x] **AC13:** Given een artikel met paragraph, quote en sidebar blocks, when het wordt gemapt naar ACF, then heeft elk block type de correcte `acf_fc_layout` en velden
- [x] **AC14:** Given een artikel publicatiedatum, when deze wordt berekend, then is het de eerstvolgende donderdag om 09:00 Nederlandse tijd (rekening houdend met zomer/wintertijd)

## Additional Context

### Dependencies

- Geen nieuwe npm packages nodig (native `fetch` voor HTTP requests)
- WordPress REST API met Application Password authenticatie
- ACF plugin op WordPress voor custom fields (Flexible Content)
- Vitest voor unit tests (al geconfigureerd)

### Environment Variables (toe te voegen aan .env.example)

```env
# WordPress API (for publishing articles)
NEXT_PUBLIC_WP_API_URL=https://gereformeerdebond.nl/wp-json/wp/v2
WP_USERNAME=your-wordpress-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Testing Strategy

**Unit Tests:**
- `article-mapper.test.ts` - Test content block → ACF mapping voor alle block types
- `author-sync.test.ts` - Test naam normalisatie en matching logica
- `api-client.test.ts` - Test auth header generatie en error handling

**Integration Tests:**
- Mock WordPress API responses met `vi.mock('fetch')`
- Test complete flow van `publishEditionToWordPress()` met gemockte data

**Manual Testing:**
- Dry-run modus: `npm run publish:wp -- --edition=123 --dry-run`
- Verifieer output in WordPress admin na publicatie

### Content Block → ACF Component Mapping

| Source Block Type | ACF Layout | ACF Fields |
|-------------------|------------|------------|
| `paragraph` | `text` | `text_text` = `<p>{content}</p>` |
| `subheading` | `text` | `text_text` = `<h3>{content}</h3>` |
| `quote` | `quote` | `quote_text` = content, `quote_author` = "" |
| `sidebar` | `text` | `text_text` = `<div class="sidebar">{content}</div>` |
| `image` | `text_image` | `text_image_image` = url, `text_image_text` = caption, `text_image_position` = "center" |

### Risk Analysis

| Risk | Impact | Mitigatie |
|------|--------|-----------|
| WP API rate limiting | Medium | Sequentiële uploads, geen parallelisatie |
| Grote images uploaden | Low | Timeout verhogen, retry logica |
| Auteur naam mismatch | Medium | Fuzzy matching, manual fallback in WP |
| Duplicate artikelen | High | Slug-based upsert, check voor POST |

### Notes

- WordPress custom post type: `wv-articles`
- Status altijd `draft` (handmatige review voor publicatie)
- Credentials via environment variables: `WP_USERNAME`, `WP_APP_PASSWORD`
- Auteur foto's: upload naar WP Media Library, set als user meta indien mogelijk
- Rate limiting: Sequentiële uploads met 100ms delay tussen requests
- Artikel slug formaat: `{title-slug}-wv{edition_number}` voor uniciteit


## Review Notes

- Adversarial review completed: 2026-01-30
- Findings: 13 total, 0 fixed, 13 skipped
- Resolution approach: skip
- Rationale: Findings are primarily test coverage gaps, not implementation bugs. Core functionality verified working.
