---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
status: complete
inputDocuments:
  - prd.md
  - architecture.md
---

# waarheidsvriend-content-db - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for waarheidsvriend-content-db, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Editie Upload & Verwerking:**
- FR1: Joost kan een InDesign XHTML-exportmap uploaden (mapstructuur met HTML, images, CSS)
- FR2: Joost kan een PDF (drukwerkversie) van de editie uploaden
- FR3: Systeem verwerkt geüploade bestanden automatisch na upload
- FR4: Joost kan de verwerkingsstatus zien tijdens het parsen

**Content Parsing:**
- FR5: Systeem verwerkt alle HTML-bestanden uit `/html/` submap (één per spread)
- FR6: Systeem extraheert afbeeldingen uit `/image/` submap
- FR7: Systeem gebruikt CSS-informatie om content-structuur te interpreteren
- FR8: Systeem herkent artikelen die over meerdere spreads lopen
- FR9: Systeem extraheert individuele artikelen uit XHTML-export
- FR10: Systeem extraheert artikeltitels
- FR11: Systeem extraheert artikel-chapeaus
- FR12: Systeem extraheert artikel body-content als schone HTML
- FR13: Systeem extraheert artikelauteurs
- FR14: Systeem extraheert auteursfoto's
- FR15: Systeem koppelt afbeeldingen aan artikelen op basis van HTML-referenties
- FR16: Systeem leidt paginanummers af uit HTML-bestandsnamen
- FR17: Systeem identificeert artikelcategorieën/rubrieken
- FR18: Systeem extraheert artikel-introducties/excerpts
- FR19: Systeem extraheert kaders als aparte content blocks
- FR20: Systeem extraheert tussenkoppen binnen artikelen
- FR21: Systeem extraheert streamers (quotes)

**PDF Verwerking:**
- FR22: Systeem converteert PDF-pagina's naar individuele afbeeldingen
- FR23: Systeem slaat pagina-afbeeldingen op gekoppeld aan editie
- FR24: Systeem associeert pagina-afbeeldingen met artikelen op basis van paginanummers

**Review Interface:**
- FR25: Joost kan een lijst van alle artikelen in een editie bekijken
- FR26: Joost kan de geparsede content van een individueel artikel bekijken
- FR27: Joost kan de bijbehorende PDF-spread(s) naast een artikel bekijken
- FR28: Joost kan navigeren tussen artikelen (vorige/volgende)
- FR29: Joost kan zien welke afbeeldingen bij elk artikel horen

**Content API:**
- FR30: WordPress kan alle artikelen voor een specifieke editie ophalen
- FR31: WordPress kan individuele artikeldetails ophalen (titel, content, auteur, categorie, afbeeldingen)
- FR32: WordPress kan auteurinformatie inclusief foto ophalen
- FR33: WordPress kan artikelafbeeldingen en onderschriften ophalen
- FR34: WordPress kan artikel featured image ophalen

**Data Management:**
- FR35: Systeem slaat edities op met metadata (editienummer, datum)
- FR36: Systeem slaat artikelen op gekoppeld aan hun editie
- FR37: Systeem slaat auteurs op met hun profielen en foto's
- FR38: Systeem slaat artikel-auteur relaties op
- FR39: Systeem slaat afbeeldingen op met metadata en onderschriften
- FR40: Systeem slaat pagina-afbeeldingen op gekoppeld aan edities

### NonFunctional Requirements

**Performance:**
- NFR1: Parser verwerkt volledige editie (12 spreads, ~15 artikelen) binnen 2 minuten
- NFR2: Review interface laadt artikel-weergave binnen 500ms
- NFR3: PDF-naar-images conversie voltooit binnen 1 minuut (24 pagina's)
- NFR4: API response tijd <500ms

**Security:**
- NFR5: Systeem alleen toegankelijk vanaf localhost of via authenticatie
- NFR6: Database credentials in environment variables (niet in code)

**Integration:**
- NFR7: API volgt REST-conventies voor WordPress compatibiliteit
- NFR8: API retourneert JSON in consistent format
- NFR9: Afbeelding-URLs direct toegankelijk voor WordPress media imports

**Reliability:**
- NFR10: Parser-fouten stoppen niet gehele verwerking (graceful degradation per artikel)
- NFR11: Systeem logt parsing-fouten voor debugging

### Additional Requirements

**Starter Template (Architecture):**
- Project initialisatie via `npx create-next-app@latest` met TypeScript, Tailwind, ESLint, App Router, src directory, Turbopack
- Dit wordt Epic 1, Story 1

**Infrastructure & Deployment:**
- Docker Compose configuratie voor Next.js + PostgreSQL
- Lokaal filesystem (volume) voor file storage
- Poppler (pdftoppm) in Docker container voor PDF processing

**Database & ORM:**
- PostgreSQL database
- Prisma ORM met declaratief schema
- Prisma Migrate voor migraties

**Authentication:**
- NextAuth.js (Credentials provider) voor UI authenticatie
- API Key (`X-API-Key` header) voor externe API authenticatie (WordPress)

**Frontend Architecture:**
- shadcn/ui component library
- React Query voor server state management
- Consistente API response format: `{ success, data/error }`

**Project Structure:**
- `src/` directory met App Router
- `src/services/parser/` voor XHTML parser logic
- `src/services/pdf/` voor PDF processing
- `src/components/ui/` voor shadcn/ui componenten
- `src/lib/` voor infrastructure (db, auth, utils)
- `uploads/` volume voor bestanden

**Naming Conventions:**
- Database: snake_case tabellen, PascalCase Prisma models
- API: kebab-case endpoints, `/api/v1/` prefix
- Code: PascalCase components, camelCase hooks/utilities

**Error Handling:**
- Per-artikel error isolation in parser
- Gestructureerde error codes: NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED, PARSE_ERROR, INTERNAL_ERROR

### FR Coverage Map

| FR | Epic | Beschrijving |
|----|------|--------------|
| FR1 | Epic 2 | XHTML-exportmap uploaden |
| FR2 | Epic 2 | PDF uploaden |
| FR3 | Epic 2 | Automatische verwerking na upload |
| FR4 | Epic 2 | Verwerkingsstatus tonen |
| FR5 | Epic 2 | HTML-bestanden uit /html/ verwerken |
| FR6 | Epic 2 | Afbeeldingen uit /image/ extraheren |
| FR7 | Epic 2 | CSS-informatie voor structuur |
| FR8 | Epic 2 | Artikelen over meerdere spreads |
| FR9 | Epic 2 | Individuele artikelen extraheren |
| FR10 | Epic 2 | Artikeltitels extraheren |
| FR11 | Epic 2 | Artikel-chapeaus extraheren |
| FR12 | Epic 2 | Body-content als schone HTML |
| FR13 | Epic 2 | Artikelauteurs extraheren |
| FR14 | Epic 2 | Auteursfoto's extraheren |
| FR15 | Epic 2 | Afbeeldingen koppelen aan artikelen |
| FR16 | Epic 2 | Paginanummers afleiden |
| FR17 | Epic 2 | Categorieën/rubrieken identificeren |
| FR18 | Epic 2 | Introducties/excerpts extraheren |
| FR19 | Epic 2 | Kaders als content blocks |
| FR20 | Epic 2 | Tussenkoppen extraheren |
| FR21 | Epic 2 | Streamers (quotes) extraheren |
| FR22 | Epic 2 | PDF naar individuele afbeeldingen |
| FR23 | Epic 2 | Pagina-afbeeldingen opslaan |
| FR24 | Epic 2 | Pagina-afbeeldingen koppelen aan artikelen |
| FR25 | Epic 3 | Artikellijst per editie |
| FR26 | Epic 3 | Geparsede content bekijken |
| FR27 | Epic 3 | PDF-spread naast artikel |
| FR28 | Epic 3 | Navigatie tussen artikelen |
| FR29 | Epic 3 | Afbeeldingen per artikel tonen |
| FR30 | Epic 4 | Artikelen per editie ophalen |
| FR31 | Epic 4 | Individuele artikeldetails |
| FR32 | Epic 4 | Auteurinformatie ophalen |
| FR33 | Epic 4 | Artikelafbeeldingen ophalen |
| FR34 | Epic 4 | Featured image ophalen |
| FR35 | Epic 1 | Edities opslaan met metadata |
| FR36 | Epic 1 | Artikelen gekoppeld aan editie |
| FR37 | Epic 1 | Auteurs met profielen en foto's |
| FR38 | Epic 1 | Artikel-auteur relaties |
| FR39 | Epic 1 | Afbeeldingen met metadata |
| FR40 | Epic 1 | Pagina-afbeeldingen gekoppeld aan edities |

## Epic List

### Epic 1: Project Foundation & Authenticatie
Operationeel systeem met database, authenticatie en basis UI. Na dit epic kan de gebruiker inloggen en is de database klaar voor content opslag.
**FRs:** FR35, FR36, FR37, FR38, FR39, FR40
**NFRs:** NFR5, NFR6

### Epic 2: Editie Upload & Content Extractie
Volledige verwerkingspipeline van upload tot geparsede content. Na dit epic kan de gebruiker XHTML en PDF uploaden, wordt alle content automatisch geëxtraheerd (artikelen, auteurs, afbeeldingen) en worden PDF-pagina's geconverteerd naar afbeeldingen.
**FRs:** FR1-FR24
**NFRs:** NFR1, NFR3, NFR10, NFR11

### Epic 3: Review Interface
Visuele verificatie van geparsede content met PDF-vergelijking. Na dit epic kan de gebruiker artikelen bekijken in een split-view met PDF-spread links en geparsede content rechts, en navigeren tussen artikelen.
**FRs:** FR25-FR29
**NFRs:** NFR2

### Epic 4: WordPress Content API
REST API voor WordPress integratie. Na dit epic kan WordPress artikelen, auteurs en afbeeldingen ophalen voor publicatie.
**FRs:** FR30-FR34
**NFRs:** NFR4, NFR7, NFR8, NFR9

---

## Epic 1: Project Foundation & Authenticatie

**Doel:** Operationeel systeem met database, authenticatie en basis UI. Na dit epic kan de gebruiker inloggen en is de database klaar voor content opslag.

### Story 1.1: Project Initialisatie

**Als** developer,
**Wil ik** een Next.js project opgezet hebben met de juiste configuratie,
**Zodat** ik kan beginnen met de implementatie van features.

**Acceptance Criteria:**

**Given** een lege project directory
**When** het project wordt geïnitialiseerd
**Then** is er een werkend Next.js project met:
- TypeScript configuratie
- Tailwind CSS
- ESLint
- App Router met `src/` directory
- Turbopack als dev server
- Import alias `@/*`

**And** de development server start zonder errors op `localhost:3000`
**And** het project volgt de directory structuur uit Architecture.md

---

### Story 1.2: Docker Compose Setup

**Als** developer,
**Wil ik** een Docker Compose configuratie hebben,
**Zodat** het systeem consistent draait met PostgreSQL database.

**Acceptance Criteria:**

**Given** het geïnitialiseerde Next.js project
**When** `docker-compose up` wordt uitgevoerd
**Then** start de Next.js applicatie in een container
**And** start PostgreSQL database in een container
**And** is er een persistent volume voor database data
**And** is er een persistent volume voor uploads (`uploads/`)
**And** zijn environment variables geconfigureerd via `.env` file
**And** bevat `.env.example` alle benodigde variabelen

**Given** de containers draaien
**When** de Next.js app een database connectie probeert
**Then** is de PostgreSQL database bereikbaar

---

### Story 1.3: Database Schema

**Als** developer,
**Wil ik** een Prisma schema hebben met alle benodigde tabellen,
**Zodat** content data gestructureerd kan worden opgeslagen.

**Acceptance Criteria:**

**Given** Docker Compose met PostgreSQL draait
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

**And** zijn er foreign key constraints tussen gerelateerde tabellen
**And** is er een `src/lib/db.ts` met Prisma client singleton
**And** volgen alle tabelnamen snake_case conventie

---

### Story 1.4: Authenticatie Configuratie

**Als** Joost,
**Wil ik** kunnen inloggen in het systeem,
**Zodat** alleen ik toegang heb tot de applicatie (NFR5).

**Acceptance Criteria:**

**Given** het project met database
**When** NextAuth.js wordt geconfigureerd
**Then** is er een login pagina op `/login`
**And** kan ik inloggen met credentials (username/password uit env vars)
**And** worden niet-ingelogde gebruikers doorgestuurd naar `/login`
**And** zijn alle routes onder `/(auth)/` beschermd

**Given** ik ben ingelogd
**When** ik naar een beschermde pagina navigeer
**Then** zie ik de pagina content

**Given** ik ben niet ingelogd
**When** ik naar een beschermde pagina navigeer
**Then** word ik doorgestuurd naar `/login`

**And** is er een API Key middleware in `src/lib/api-key.ts`
**And** valideren `/api/v1/*` routes de `X-API-Key` header
**And** staan credentials NIET in code maar in environment variables (NFR6)

---

### Story 1.5: Basis UI Layout

**Als** Joost,
**Wil ik** een consistente UI layout hebben,
**Zodat** ik makkelijk kan navigeren door het systeem.

**Acceptance Criteria:**

**Given** shadcn/ui is geïnstalleerd
**When** ik de applicatie open
**Then** zie ik een header met:
- Applicatienaam
- Navigatie naar Edities
- Logout knop

**And** is er een `src/components/ui/` folder met shadcn/ui componenten
**And** zijn minimaal de volgende componenten beschikbaar: Button, Card, Input, Skeleton
**And** is er een `src/components/shared/Header.tsx` component
**And** is er een root layout die de header bevat
**And** is er een placeholder homepage die doorverwijst naar `/editions`

---

## Epic 2: Editie Upload & Content Extractie

**Doel:** Volledige verwerkingspipeline van upload tot geparsede content. Na dit epic kan de gebruiker XHTML en PDF uploaden, wordt alle content automatisch geëxtraheerd (artikelen, auteurs, afbeeldingen) en worden PDF-pagina's geconverteerd naar afbeeldingen.

### Story 2.1: Upload Interface

**Als** Joost,
**Wil ik** een XHTML-exportmap en PDF kunnen uploaden,
**Zodat** ik een nieuwe editie kan laten verwerken.

**Acceptance Criteria:**

**Given** ik ben ingelogd
**When** ik naar `/editions/upload` navigeer
**Then** zie ik een upload formulier met:
- Veld voor XHTML-exportmap (folder/zip upload)
- Veld voor PDF bestand
- Upload knop

**Given** ik heb bestanden geselecteerd
**When** ik op upload klik
**Then** worden de bestanden geüpload naar `uploads/editions/[edition-id]/`
**And** wordt de XHTML-map opgeslagen in `xhtml/` subfolder
**And** wordt de PDF opgeslagen in `pdf/` subfolder
**And** zie ik een voortgangsindicator tijdens upload

**Given** de upload is voltooid
**When** de verwerking start
**Then** worden editienummer en editiedatum geëxtraheerd uit de XHTML
**And** wordt een nieuwe editie record aangemaakt met deze metadata
**And** zie ik de verwerkingsstatus (FR4):
- "Uploaden..." → "PDF verwerken..." → "Content parsen..." → "Voltooid"

**And** is er een `src/app/api/upload/route.ts` voor file handling
**And** is er een `src/components/editions/UploadForm.tsx` component
**And** is er een `src/hooks/useUpload.ts` hook met React Query

---

### Story 2.2: PDF naar Images Converter

**Als** systeem,
**Wil ik** PDF-pagina's converteren naar afbeeldingen,
**Zodat** deze gebruikt kunnen worden voor visuele verificatie in de review interface.

**Acceptance Criteria:**

**Given** een PDF is geüpload voor een editie
**When** de PDF converter wordt aangeroepen
**Then** wordt elke PDF-pagina geconverteerd naar een PNG afbeelding (FR22)
**And** worden de afbeeldingen opgeslagen in `uploads/editions/[id]/images/pages/` (FR23)
**And** wordt voor elke pagina een `page_images` record aangemaakt met:
- `edition_id`
- `page_number` (1-indexed)
- `image_url` (relatief pad naar afbeelding)

**Given** een artikel heeft `page_start` en `page_end` waarden
**When** de pagina-afbeeldingen zijn gegenereerd
**Then** kunnen de relevante pagina-afbeeldingen worden opgehaald voor dat artikel (FR24)

**And** is Poppler (pdftoppm) geïnstalleerd in de Docker container
**And** is er een `src/services/pdf/converter.ts` service
**And** voltooit de conversie binnen 1 minuut voor 24 pagina's (NFR3)

---

### Story 2.3: XHTML Loader & Structure Analyzer

**Als** systeem,
**Wil ik** de XHTML-exportstructuur kunnen laden en analyseren,
**Zodat** de parser de juiste bestanden en styling informatie heeft.

**Acceptance Criteria:**

**Given** een XHTML-exportmap is geüpload
**When** de loader wordt aangeroepen
**Then** worden alle HTML-bestanden uit `/html/` submap geïdentificeerd (FR5)
**And** worden alle afbeeldingen uit `/image/` submap geïndexeerd (FR6)
**And** wordt de CSS uit `/css/` geladen voor structuuranalyse (FR7)

**Given** HTML-bestanden zijn geladen
**When** de bestandsnamen worden geanalyseerd
**Then** worden paginanummers afgeleid uit de bestandsnamen (FR16):
- `publication.html` → pagina 1 (cover)
- `publication-1.html` → pagina 2-3 (spread)
- `publication-N.html` → pagina (N*2), (N*2)+1

**Given** de XHTML is geladen
**When** de metadata wordt geanalyseerd
**Then** worden editienummer en editiedatum geëxtraheerd uit de HTML-content
**And** wordt de `editions` record bijgewerkt met deze waarden

**And** is er een `src/services/parser/xhtml-loader.ts` module
**And** is er een `src/services/parser/structure-analyzer.ts` module
**And** retourneert de loader een gestructureerd object met alle content en metadata

---

### Story 2.4: Artikel Extractie

**Als** systeem,
**Wil ik** individuele artikelen kunnen extraheren uit de XHTML,
**Zodat** elk artikel als aparte entiteit in de database staat.

**Acceptance Criteria:**

**Given** de XHTML is geladen en geanalyseerd
**When** de artikel-extractor draait
**Then** worden individuele artikelen geïdentificeerd (FR9)
**And** wordt voor elk artikel de titel geëxtraheerd (FR10)
**And** wordt voor elk artikel de chapeau geëxtraheerd (FR11)
**And** wordt voor elk artikel de body-content geëxtraheerd als schone HTML (FR12):
- InDesign-specifieke spans/divs verwijderd
- Lege elementen verwijderd
- Semantische HTML behouden (p, h2, h3, blockquote, etc.)

**Given** een artikel loopt over meerdere spreads
**When** de extractor dit detecteert (via CSS classes of ID patterns)
**Then** wordt de content van alle spreads samengevoegd tot één artikel (FR8)
**And** worden `page_start` en `page_end` correct gezet

**And** is er een `src/services/parser/article-extractor.ts` module
**And** worden artikelen opgeslagen in de `articles` tabel gekoppeld aan de editie

---

### Story 2.5: Auteur & Categorie Extractie

**Als** systeem,
**Wil ik** auteurs en categorieën kunnen extraheren,
**Zodat** artikelen correct worden geattribueerd en gecategoriseerd.

**Acceptance Criteria:**

**Given** artikelen zijn geëxtraheerd
**When** de auteur-extractor draait
**Then** worden auteursnamen geëxtraheerd uit de artikel-HTML (FR13)
**And** worden auteursfoto's geïdentificeerd en gekoppeld (FR14)
**And** worden nieuwe auteurs aangemaakt in de `authors` tabel
**And** worden bestaande auteurs herkend (op naam) en hergebruikt
**And** worden `article_authors` relaties aangemaakt

**Given** een artikel heeft een rubriek/categorie aanduiding
**When** de categorie wordt geëxtraheerd
**Then** wordt de rubriek/categorie opgeslagen in het `category` veld van het artikel (FR17)

**And** is er een `src/services/parser/author-extractor.ts` module
**And** worden auteursfoto's gekopieerd naar `uploads/editions/[id]/images/authors/`

---

### Story 2.6: Rich Content Extractie

**Als** systeem,
**Wil ik** afbeeldingen en rijke content elementen kunnen extraheren,
**Zodat** artikelen compleet zijn met alle visuele en structurele elementen.

**Acceptance Criteria:**

**Given** artikelen zijn geëxtraheerd
**When** de image-mapper draait
**Then** worden afbeeldingen gekoppeld aan artikelen op basis van HTML-referenties (FR15)
**And** wordt voor elke afbeelding een `images` record aangemaakt met:
- `article_id`
- `url` (pad naar afbeelding)
- `caption` (indien aanwezig)
- `is_featured` (eerste/hoofdafbeelding)

**Given** artikel-HTML wordt geanalyseerd
**When** rich content wordt geëxtraheerd
**Then** worden artikel-introducties/excerpts geëxtraheerd (FR18)
**And** worden kaders geëxtraheerd als aparte content blocks (FR19)
**And** worden tussenkoppen geëxtraheerd en behouden in de HTML (FR20)
**And** worden streamers/quotes geëxtraheerd (FR21)

**And** is er een `src/services/parser/image-mapper.ts` module
**And** worden artikelafbeeldingen gekopieerd naar `uploads/editions/[id]/images/articles/`

---

### Story 2.7: Verwerkingsorkestratie

**Als** Joost,
**Wil ik** dat bestanden automatisch worden verwerkt na upload,
**Zodat** ik niet handmatig elke stap hoef te triggeren.

**Acceptance Criteria:**

**Given** XHTML-map en PDF zijn geüpload
**When** de upload voltooid is
**Then** start automatisch de verwerkingspipeline (FR3):
1. PDF naar images conversie
2. XHTML laden en structuur analyseren
3. Artikelen extraheren
4. Auteurs en categorieën extraheren
5. Afbeeldingen en rich content koppelen

**Given** de parser een artikel niet kan verwerken
**When** een error optreedt
**Then** wordt het artikel overgeslagen (graceful degradation) (NFR10)
**And** gaat de parser door met het volgende artikel
**And** wordt de error gelogd met context (NFR11):
- Artikel identifier
- Error message
- Stack trace

**Given** de volledige pipeline draait
**When** alle stappen zijn voltooid
**Then** is de totale verwerkingstijd <2 minuten voor 12 spreads, ~15 artikelen (NFR1)
**And** wordt de editie status bijgewerkt naar "completed" of "completed_with_errors"

**And** is er een `src/services/parser/index.ts` die alle modules orkestreert
**And** is er structured logging in alle parser modules

---

## Epic 3: Review Interface

**Doel:** Visuele verificatie van geparsede content met PDF-vergelijking. Na dit epic kan de gebruiker artikelen bekijken in een split-view met PDF-spread links en geparsede content rechts, en navigeren tussen artikelen.

### Story 3.1: Editie Overzicht

**Als** Joost,
**Wil ik** een overzicht zien van alle edities en hun artikelen,
**Zodat** ik snel kan navigeren naar de content die ik wil reviewen.

**Acceptance Criteria:**

**Given** ik ben ingelogd
**When** ik naar `/editions` navigeer
**Then** zie ik een lijst van alle verwerkte edities met:
- Editienummer
- Editiedatum
- Aantal artikelen
- Verwerkingsstatus

**Given** ik klik op een editie
**When** de editie detail pagina laadt
**Then** zie ik een lijst van alle artikelen in die editie (FR25) met:
- Artikeltitel
- Auteur(s)
- Categorie/rubriek
- Paginanummers

**And** is er een `src/app/(auth)/editions/page.tsx` voor de editielijst
**And** is er een `src/app/(auth)/editions/[id]/page.tsx` voor editie detail
**And** is er een `src/components/editions/EditionCard.tsx` component
**And** is er een `src/components/editions/EditionList.tsx` component
**And** is er een `src/hooks/useEditions.ts` hook met React Query

---

### Story 3.2: Artikel Detail View

**Als** Joost,
**Wil ik** de geparsede content van een artikel kunnen bekijken,
**Zodat** ik kan verifiëren of de parsing correct is.

**Acceptance Criteria:**

**Given** ik ben op de editie detail pagina
**When** ik een artikel selecteer
**Then** zie ik de volledige geparsede content (FR26):
- Titel
- Chapeau
- Auteur(s) met foto
- Body content (gerenderde HTML)
- Excerpt

**And** zie ik alle afbeeldingen die bij het artikel horen (FR29):
- Featured image prominent weergegeven
- Overige afbeeldingen met captions
- Kaders als aparte blokken

**And** laadt de artikel-weergave binnen 500ms (NFR2)

**And** is er een `src/components/review/ArticleView.tsx` component
**And** is er een `src/hooks/useArticles.ts` hook met React Query

---

### Story 3.3: Split-View met PDF Navigatie

**Als** Joost,
**Wil ik** de PDF-spread naast de geparsede content kunnen zien,
**Zodat** ik visueel kan verifiëren of alles correct is geëxtraheerd.

**Acceptance Criteria:**

**Given** ik ben in de review interface
**When** ik een artikel bekijk
**Then** zie ik een split-view met:
- Links: PDF-spread(s) van de pagina's waar het artikel staat (FR27)
- Rechts: Geparsede artikel content

**Given** een artikel loopt over meerdere spreads
**When** ik de PDF-view bekijk
**Then** kan ik bladeren tussen de relevante spreads

**Given** ik bekijk een artikel
**When** ik wil navigeren
**Then** kan ik naar het vorige/volgende artikel navigeren (FR28)
**And** zijn er "Vorige" en "Volgende" knoppen
**And** kan ik met keyboard shortcuts navigeren (← →)

**And** is er een `src/app/(auth)/review/[editionId]/page.tsx` voor de split-view
**And** is er een `src/components/review/SplitView.tsx` component
**And** is er een `src/components/review/PdfSpreadView.tsx` component
**And** is er een `src/components/review/ArticleNavigation.tsx` component

---

## Epic 4: WordPress Content API

**Doel:** REST API voor WordPress integratie. Na dit epic kan WordPress artikelen, auteurs en afbeeldingen ophalen voor publicatie.

### Story 4.1: Editions API

**Als** WordPress,
**Wil ik** edities en hun artikelen kunnen ophalen,
**Zodat** ik weet welke content beschikbaar is voor publicatie.

**Acceptance Criteria:**

**Given** een geldige API Key in de `X-API-Key` header
**When** een GET request naar `/api/v1/editions` wordt gedaan
**Then** retourneert de API een lijst van alle edities met:
- id, editionNumber, editionDate, articleCount, status

**Given** een geldige API Key
**When** een GET request naar `/api/v1/editions/[id]/articles` wordt gedaan
**Then** retourneert de API alle artikelen voor die editie (FR30)

**Given** een ongeldige of ontbrekende API Key
**When** een request naar `/api/v1/*` wordt gedaan
**Then** retourneert de API een 401 Unauthorized response

**And** is er een `src/app/api/v1/editions/route.ts`
**And** is er een `src/app/api/v1/editions/[id]/route.ts`
**And** is er een `src/app/api/v1/editions/[id]/articles/route.ts`
**And** volgt de API REST-conventies (NFR7)
**And** is de response tijd <500ms (NFR4)

---

### Story 4.2: Articles API

**Als** WordPress,
**Wil ik** volledige artikel details kunnen ophalen,
**Zodat** ik artikelen kan aanmaken met alle content.

**Acceptance Criteria:**

**Given** een geldige API Key
**When** een GET request naar `/api/v1/articles/[id]` wordt gedaan
**Then** retourneert de API de volledige artikel details (FR31) inclusief:
- title, chapeau, excerpt, category, pageStart, pageEnd
- authors (inline met name en photoUrl)
- featuredImage (FR34)
- contentBlocks array met getypeerde blocks:
  - `paragraph` - tekst alinea
  - `subheading` - tussenkop (FR20)
  - `image` - afbeelding met caption
  - `quote` - streamer (FR21)
  - `sidebar` - kader (FR19)

**And** zijn content blocks in volgorde zoals in de publicatie
**And** zijn alle image URLs direct toegankelijk (NFR9)
**And** retourneert de API JSON in consistent format (NFR8)

**And** is er een `src/app/api/v1/articles/[id]/route.ts`
**And** is er een `src/lib/api-response.ts` met response helpers

---

### Story 4.3: Authors & Images API

**Als** WordPress,
**Wil ik** auteur- en afbeeldingsinformatie apart kunnen ophalen,
**Zodat** ik auteurprofielen kan synchroniseren en media kan importeren.

**Acceptance Criteria:**

**Given** een geldige API Key
**When** een GET request naar `/api/v1/authors` wordt gedaan
**Then** retourneert de API een lijst van alle auteurs (FR32)

**Given** een geldige API Key
**When** een GET request naar `/api/v1/authors/[id]` wordt gedaan
**Then** retourneert de API auteur details inclusief foto (FR32)

**Given** een geldige API Key
**When** een GET request naar `/api/v1/articles/[id]/images` wordt gedaan
**Then** retourneert de API alle afbeeldingen voor dat artikel (FR33)

**And** zijn afbeelding-URLs direct toegankelijk voor WordPress media imports (NFR9)

**And** is er een `src/app/api/v1/authors/route.ts`
**And** is er een `src/app/api/v1/authors/[id]/route.ts`
**And** is er een `src/app/api/v1/articles/[id]/images/route.ts`
