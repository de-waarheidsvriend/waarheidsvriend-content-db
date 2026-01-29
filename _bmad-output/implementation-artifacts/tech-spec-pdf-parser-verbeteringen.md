---
title: 'PDF Parser Verbeteringen'
slug: 'pdf-parser-verbeteringen'
created: '2026-01-29'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Prisma', 'PostgreSQL', 'Cheerio']
files_to_modify:
  - 'prisma/schema.prisma'
  - 'src/services/parser/structure-analyzer.ts'
  - 'src/services/parser/article-extractor.ts'
  - 'src/services/parser/author-extractor.ts'
  - 'src/services/parser/image-mapper.ts'
  - 'src/services/parser/xhtml-loader.ts'
  - 'src/types/index.ts'
code_patterns: ['Prisma upsert', 'Cheerio DOM parsing', 'CSS class classification']
test_patterns: ['Unit tests with Vitest']
---

# Tech-Spec: PDF Parser Verbeteringen

**Created:** 2026-01-29

## Overview

### Problem Statement

De PDF parser extraheert artikelen incorrect uit InDesign XHTML exports:

1. **Cover headlines als artikelen**: `Omslag_Kop` class wordt herkend als article title, waardoor cover teasers als aparte artikelen worden opgeslagen. Deze moeten als editie-niveau metadata worden bewaard.

2. **Meditatie verse splitst artikel**: `Meditatie_kop-boven-vers` class (het vers/lied boven de meditatie) wordt als title gezien, waardoor de meditatie in twee artikelen wordt gesplitst.

3. **Verkeerde auteur associatie**: Auteurs worden geassocieerd op spread-niveau (page overlap), niet op artikel-niveau. Als de inhoudspagina meerdere auteurs vermeldt, krijgen artikelen verkeerde auteurs.

4. **Auteur bio mist**: De auteur onderschrift/bio ("is predikant van de hervormde gemeente te Jaarsveld") wordt niet geëxtraheerd. Class `Onderschrift-auteur_naam-auteur` wordt als caption gezien ipv author_bio.

5. **Verkeerde chapeau**: Chapeau wordt geassocieerd op spread-niveau, niet proximity-based. Artikelen krijgen chapeaus van andere artikelen op dezelfde spread.

6. **Auteursfoto's als article images**: Auteursfoto's (bijv. `Bogerd,_ds._K.H._(2025).jpg`) worden niet gefilterd en verschijnen als featured images bij artikelen.

### Solution

Aanpassingen aan de parser pipeline en database schema:

1. **Single-page export support** - Overstappen van spread-based (2 pagina's per HTML) naar single-page export (1 pagina per HTML)
2. **Title + ■ boundary detectie** - Artikel begint bij title class, eindigt bij ■ karakter. Alles ertussen hoort bij het artikel (chapeau, auteur, body, images). Dit elimineert complexe merge heuristics en proximity checks.
3. **Cover metadata extractie** - `Omslag_*` content extraheren naar editie-niveau velden (geen ■, dus apart behandelen)
4. **Class filtering** - `Omslag_*` classes uitsluiten van article extraction
5. **Meditatie verse class** - `Meditatie_kop-boven-vers` classificeren als `intro` ipv `title`
6. **Author bio extractie** - Nieuwe field voor auteur onderschrift
7. **Verbeterde auteursfoto filtering** - Images direct na auteur blokken markeren als auteursfoto

### Scope

**In Scope:**
- Parser: Single-page export support (1 HTML = 1 pagina ipv spread)
- Parser: Title + ■ boundary detectie (vervangt complexe grouping/merge logic)
- Database schema: `cover_headlines` JSON field op Edition, `author_bio` field op Article
- Parser: Cover metadata extractie
- Parser: `Omslag_*` en `Meditatie_kop-boven-vers` class re-classificatie
- Parser: Author bio extractie
- Parser: Auteursfoto filtering via DOM context
- Bestaande API responses uitbreiden met nieuwe velden

**Out of Scope:**
- UI wijzigingen
- Nieuwe API endpoints
- Re-processing van bestaande edities (handmatig triggeren indien nodig)
- Backward compatibility met spread-based exports (InDesign wordt omgezet naar single-page)

## Context for Development

### Single-Page Export Format

**Wijziging in InDesign export workflow:** Voortaan exporteren we naar single-page HTML ipv spread-based HTML.

**Spread-based (oud):**
- `publication.html` → spread 0, page 1 (cover)
- `publication-N.html` → spread N, pages N*2 en N*2+1 (2 pagina's per bestand)
- Artikelen op dezelfde spread kunnen content "door elkaar" hebben

**Single-page (nieuw):**
- `publication.html` → page 1 (cover)
- `publication-N.html` → page N+1 (1 pagina per bestand)
- Preciezere page-level positie voor proximity-based associatie

**Impact op bestaande parser:**
- `parseSpreadFromFilename()` in `xhtml-loader.ts` moet aangepast worden
- `groupElementsIntoArticles()` wordt vervangen door title→■ boundary detectie
- `mergeMultiSpreadArticles()` kan verwijderd worden (niet meer nodig)
- Proximity-based associatie niet meer nodig: alles tussen title en ■ hoort bij artikel

### Artikel Boundary Marker: ■

InDesign exports bevatten het ■ karakter (zwart vierkantje) als expliciet artikel-einde marker.

**Voorbeeld uit HTML:**
```html
<span class="CharOverride-32">■</span>
```

**Eigenschappen:**
- Staat altijd aan het einde van een artikel
- 9 voorkomens in editie = 9 artikelen
- Class varieert (CharOverride-32, -54, -59), maar karakter is consistent
- Cover content heeft geen ■ (apart te behandelen)

**Nieuwe grouping logica:**
```
Title element → start nieuw artikel
■ karakter → einde huidig artikel
Alles ertussen → hoort bij dat artikel (body, chapeau, auteur, images)
```

Dit elimineert de noodzaak voor:
- Punctuatie-based einde detectie
- Multi-spread merge heuristics
- DOM proximity checks voor chapeau/auteur associatie

### Codebase Patterns

1. **Class Classification** (`structure-analyzer.ts`):
   - `classifyClassName()` functie bepaalt type op basis van class name patterns
   - Returnwaarde: `title`, `chapeau`, `body`, `author`, `category`, `subheading`, `streamer`, `sidebar`, `caption`, `article-boundary`
   - Nieuwe types toe te voegen: `cover-title`, `cover-chapeau`, `intro-verse`, `author-bio`

2. **Element Extraction** (`article-extractor.ts`):
   - `extractElementsFromSpread()` extraheert elementen per spread
   - `groupElementsIntoArticles()` groepeert op basis van title boundaries
   - Elements hebben: `type`, `content`, `className`, `spreadIndex`, `pageStart`, `pageEnd`

3. **Author Association** (`author-extractor.ts`):
   - `extractAuthorElementsFromSpreads()` associeert op page overlap
   - **Probleem**: Alle auteur elementen op spread gaan naar alle overlappende artikelen

4. **Image Filtering** (`image-mapper.ts`):
   - `extractImagesForArticle()` filtert op `logo`, `icon`, `adv_`, `advertentie`, `data:`
   - **Ontbreekt**: Filter voor auteursfoto's

5. **Auteur HTML Structuur** (InDesign export):
   ```html
   <p class="Artikelen_info-auteur">
     <span class="Onderschrift-auteur_naam-auteur">Ds. K.H. Bogerd</span>
   </p>
   <p class="Artikelen_Onderschrift-auteur">is predikant van de hervormde gemeente...</p>
   <img src="../image/Bogerd,_ds._K.H._(2025).jpg" />  <!-- direct na auteur block -->
   ```
   - `Onderschrift-auteur_naam-auteur` = auteur naam (span)
   - `Artikelen_Onderschrift-auteur` = auteur bio (paragraph)
   - Auteursfoto staat direct na het auteur blok in de DOM

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `prisma/schema.prisma` | Database schema - Edition en Article models |
| `src/services/parser/structure-analyzer.ts` | CSS class classification |
| `src/services/parser/article-extractor.ts` | Article grouping en building |
| `src/services/parser/author-extractor.ts` | Author extraction en association |
| `src/services/parser/image-mapper.ts` | Image filtering en mapping |
| `src/services/parser/xhtml-loader.ts` | XHTML loading en metadata extraction |
| `src/types/index.ts` | TypeScript type definitions |

### Technical Decisions

1. **Single-page export**: InDesign exporteert voortaan naar single-page HTML (1 pagina per bestand). Geen backward compatibility met spread-based exports.

2. **Title + ■ boundaries**: Artikel begint bij title class, eindigt bij ■ karakter. Dit is betrouwbaarder dan heuristics (punctuatie, spread boundaries) en elimineert de noodzaak voor merge logic en proximity checks. Alles tussen title en ■ hoort automatisch bij dat artikel.

3. **Cover headlines als JSON**: Opslaan als `cover_headlines` JSON array op Edition model. Structuur: `[{title: string, subtitle?: string, pageRef?: string}]`. Cover content heeft geen ■ marker en wordt apart behandeld.

4. **Author bio op Article**: Opslaan als `author_bio` string op Article model (niet op Author). De bio beschrijft de auteur in context van het specifieke artikel en kan variëren.

5. **Auteursfoto via DOM positie**: Images direct na auteur blokken zijn auteursfoto's. Geen filename regex nodig.

## Implementation Plan

### Task Checklist

- [ ] **Task 0**: Single-Page Export Support (`xhtml-loader.ts`)
- [ ] **Task 1**: Database Schema Update (`prisma/schema.prisma`)
- [ ] **Task 2**: Type Definitions Update (`src/types/index.ts`)
- [ ] **Task 3**: Structure Analyzer Updates (`structure-analyzer.ts`)
- [ ] **Task 4**: Cover Metadata Extraction (`xhtml-loader.ts`)
- [ ] **Task 5**: Article Extractor - Title + ■ Boundaries (`article-extractor.ts`)
- [ ] **Task 6**: Author Extractor Simplification (`author-extractor.ts`)
- [ ] **Task 7**: Image Mapper Updates (`image-mapper.ts`)
- [ ] **Task 8**: Parser Index Update (`parser/index.ts`)
- [ ] **Task 9**: Database Save Updates (`article-extractor.ts`)

### Task Details

#### Task 0: Single-Page Export Support
**File:** `src/services/parser/xhtml-loader.ts`

**Doel:** Aanpassen van page mapping voor single-page HTML export (1 pagina per bestand ipv 2).

0.1 Update `parseSpreadFromFilename()` functie:
```typescript
/**
 * Parse page information from HTML filename
 *
 * Single-page export mapping:
 * - publication.html → page 1 (cover)
 * - publication-N.html → page N+1
 */
export function parseSpreadFromFilename(filename: string): SpreadInfo {
  const baseName = basename(filename, ".html");

  if (baseName === "publication") {
    // Cover page (page 1)
    return {
      filename,
      spreadIndex: 0,
      pageStart: 1,
      pageEnd: 1,
    };
  }

  // publication-N pattern: N+1 is the page number
  const match = baseName.match(/^publication-(\d+)$/);
  if (match) {
    const fileIndex = parseInt(match[1]);
    const pageNumber = fileIndex + 1; // publication-1.html = page 2
    return {
      filename,
      spreadIndex: fileIndex, // Keep for ordering/grouping
      pageStart: pageNumber,
      pageEnd: pageNumber, // Single page, not spread!
    };
  }

  throw new Error(`Unknown HTML filename pattern: ${filename}`);
}
```

**Wijziging tov huidige code:**
- `pageEnd` was `spreadIndex * 2 + 1`, nu `pageNumber` (zelfde als `pageStart`)
- `pageStart` was `spreadIndex * 2`, nu `fileIndex + 1`

**Verificatie:** Bestaande `mergeMultiSpreadArticles()` werkt ongewijzigd - detecteert al multi-page artikelen via `spreadIndex` verschil check.

---

#### Task 1: Database Schema Update
**File:** `prisma/schema.prisma`

1.1 Voeg `cover_headlines` field toe aan Edition model:
```prisma
model Edition {
  // ... existing fields ...
  cover_headlines Json?    // [{title, subtitle?, pageRef?}]
}
```

1.2 Voeg `author_bio` field toe aan Article model:
```prisma
model Article {
  // ... existing fields ...
  author_bio String?
}
```

1.3 Run migration:
```bash
npx prisma migrate dev --name add-cover-headlines-and-author-bio
```

#### Task 2: Type Definitions Update
**File:** `src/types/index.ts`

2.1 Voeg nieuwe types toe:
```typescript
export interface CoverHeadline {
  title: string;
  subtitle?: string;
  pageRef?: string;
}

export interface StyleAnalysis {
  // ... existing fields ...
  coverTitleClasses: string[];
  coverChapeauClasses: string[];
  introVerseClasses: string[];
  authorBioClasses: string[];
}

export interface ArticleElement {
  type: 'title' | 'chapeau' | 'body' | 'author' | 'category' |
        'subheading' | 'streamer' | 'sidebar' | 'caption' | 'image' |
        'cover-title' | 'cover-chapeau' | 'intro-verse' | 'author-bio' |
        'article-end' | 'unknown';  // article-end = ■ marker
  // ... rest unchanged ...
}
```

#### Task 3: Structure Analyzer Updates
**File:** `src/services/parser/structure-analyzer.ts`

3.1 Update `classifyClassName()` functie - voeg nieuwe patterns toe VOOR bestaande patterns:
```typescript
// Cover patterns (check FIRST - before general kop/chapeau)
if (lowerName.includes('omslag_kop') || lowerName.includes('cover_title')) {
  return 'cover-title';
}
if (lowerName.includes('omslag_ankeiler') || lowerName.includes('omslag_chapeau')) {
  return 'cover-chapeau';
}

// Meditatie verse pattern (check before title)
if (lowerName.includes('meditatie_kop-boven-vers') || lowerName.includes('kop-boven-vers')) {
  return 'intro-verse';
}

// Author bio pattern - specifically the description paragraph (check before caption)
// Note: 'Artikelen_Onderschrift-auteur' = bio, 'Onderschrift-auteur_naam-auteur' = name (span)
if (lowerName === 'artikelen_onderschrift-auteur' ||
    (lowerName.includes('onderschrift-auteur') && !lowerName.includes('naam'))) {
  return 'author-bio';
}

// Author name pattern (span class within info-auteur)
if (lowerName.includes('onderschrift-auteur_naam-auteur')) {
  return 'author'; // Treat as author name
}
```

3.2 Update `addClassToCategories()` en return types voor nieuwe categorieën

3.3 Update `StyleAnalysis` interface en return objects

#### Task 4: XHTML Loader - Cover Metadata Extraction
**File:** `src/services/parser/xhtml-loader.ts`

4.1 Voeg nieuwe functie toe:
```typescript
export function extractCoverMetadata(
  coverSpread: LoadedSpread,
  styles: StyleAnalysis
): CoverHeadline[] {
  const headlines: CoverHeadline[] = [];
  const $ = cheerio.load(coverSpread.html);

  // Build selectors
  const titleSelector = styles.coverTitleClasses.map(c => `.${c}`).join(', ');
  const chapeauSelector = styles.coverChapeauClasses.map(c => `.${c}`).join(', ');

  // Extract cover titles with their associated subtitles
  $(titleSelector).each((_, el) => {
    const title = $(el).text().trim();
    if (!title) return;

    // Look for associated chapeau/ankeiler nearby
    const headline: CoverHeadline = { title };

    // Find next sibling or nearby chapeau element
    // ... proximity logic ...

    headlines.push(headline);
  });

  return headlines;
}
```

4.2 Update `loadXhtmlExport()` om cover metadata te extraheren en terug te geven

#### Task 5: Article Extractor - Title + ■ Boundary Logic
**File:** `src/services/parser/article-extractor.ts`

**Doel:** Vervang complexe grouping/merge logic met eenvoudige title→■ boundary detectie.

5.1 Voeg `article-end` type toe voor ■ detectie:
```typescript
// In extractElementsFromSpread(), detect ■ character
if ($el.text().includes('■')) {
  elements.push({
    type: 'article-end',
    content: '■',
    className,
    spreadIndex: spread.spreadIndex,
    pageStart: spread.pageStart,
    pageEnd: spread.pageEnd,
  });
}
```

5.2 Herschrijf `groupElementsIntoArticles()` met title→■ logic:
```typescript
function groupElementsIntoArticles(elements: ArticleElement[]): ArticleElement[][] {
  const articles: ArticleElement[][] = [];
  let currentArticle: ArticleElement[] = [];

  for (const element of elements) {
    // Skip cover elements
    if (element.type === 'cover-title' || element.type === 'cover-chapeau') {
      continue;
    }

    if (element.type === 'title') {
      // Title starts a new article
      if (currentArticle.length > 0) {
        articles.push(currentArticle);
      }
      currentArticle = [element];
    } else if (element.type === 'article-end') {
      // ■ ends current article
      if (currentArticle.length > 0) {
        articles.push(currentArticle);
        currentArticle = [];
      }
    } else {
      // All other elements belong to current article
      if (currentArticle.length > 0) {
        currentArticle.push(element);
      }
    }
  }

  // Handle last article if no ■ found (shouldn't happen normally)
  if (currentArticle.length > 0) {
    articles.push(currentArticle);
  }

  return articles;
}
```

5.3 **Verwijder** `mergeMultiSpreadArticles()` - niet meer nodig met ■ boundaries.

5.4 Vereenvoudig `buildExtractedArticle()`:
- Geen proximity checks nodig - alles tussen title en ■ hoort bij artikel
- Chapeau = eerste element met type `chapeau` of `intro-verse`
- Author = alle elements met type `author`
- Author bio = eerste element met type `author-bio`

```typescript
const chapeauElement = elements.find(el =>
  el.type === 'chapeau' || el.type === 'intro-verse'
);
const authorBioElement = elements.find(el => el.type === 'author-bio');
const authorBio = authorBioElement ? htmlToPlainText(authorBioElement.content) : null;
```

#### Task 6: Author Extractor Simplification
**File:** `src/services/parser/author-extractor.ts`

6.1 **Vereenvoudigd door title→■ boundaries**: Auteur elements zitten al in de juiste article group (tussen title en ■). Geen aparte filtering meer nodig.

6.2 Update `associateAuthorsWithArticles()`:
```typescript
// Authors are already grouped with their article via title→■ boundaries
// Just extract author names from the article's author elements
for (const article of articles) {
  const authorElements = article.elements.filter(el => el.type === 'author');
  article.authorNames = authorElements.map(el => htmlToPlainText(el.content));
}
```

#### Task 7: Image Mapper Updates
**File:** `src/services/parser/image-mapper.ts`

7.1 Auteursfoto's identificeren via DOM context (niet filename regex):

**Aanpak:** Tijdens element extractie, track welke images direct na auteur blokken staan.

In `article-extractor.ts`, update `extractElementsFromSpread()`:
```typescript
// Track images that follow author elements (within 2 DOM siblings)
let lastAuthorIndex = -1;
const authorPhotoFilenames = new Set<string>();

$("p, div, span, img").each((idx, el) => {
  const $el = $(el);
  const className = $el.attr("class") || "";

  // Track author elements
  if (className.includes("info-auteur") || className.includes("Onderschrift-auteur")) {
    lastAuthorIndex = idx;
  }

  // If this is an image within 2 elements of an author block, mark as author photo
  if (el.name === "img" && lastAuthorIndex >= 0 && (idx - lastAuthorIndex) <= 2) {
    const src = $el.attr("src") || "";
    const filename = src.split("/").pop() || "";
    if (filename && !filename.startsWith("data:")) {
      authorPhotoFilenames.add(filename);
    }
  }
});
```

7.2 Pass `authorPhotoFilenames` naar image-mapper en filter:
```typescript
const contentImages = referencedImages.filter((filename) => {
  // Existing filters...

  // NEW: Skip images identified as author photos by DOM position
  if (authorPhotoFilenames.has(filename)) return false;

  return true;
});
```

**Voordeel:** Geen fragiele filename regex nodig - we gebruiken de DOM structuur die InDesign genereert.

#### Task 8: Parser Index Update
**File:** `src/services/parser/index.ts`

8.1 Update orchestration om cover metadata te extraheren en op te slaan
8.2 Pass `author_bio` door naar article save

#### Task 9: Database Save Updates

9.1 Update article creation in `saveArticles()`:
```typescript
data: {
  // ... existing fields ...
  author_bio: article.authorBio,
}
```

9.2 Update edition save om `cover_headlines` op te slaan

### Acceptance Criteria

#### AC0: Single-Page Export Support
**Given** een single-page XHTML export (24 HTML bestanden voor 24 pagina's)
**When** de parser wordt uitgevoerd
**Then** wordt elk HTML bestand correct gemapt naar 1 pagina (publication-3.html = page 4)
**And** hebben artikelen correcte `page_start` en `page_end` waarden

#### AC1: Title + ■ Boundary Detection
**Given** een XHTML export met artikelen die beginnen met title class en eindigen met ■
**When** de parser wordt uitgevoerd
**Then** wordt elk artikel correct gegroepeerd van title tot ■
**And** worden multi-page artikelen (title op pagina X, ■ op pagina Y) correct samengevoegd
**And** is het aantal geëxtraheerde artikelen gelijk aan het aantal ■ karakters

#### AC2: Cover Headlines
**Given** een XHTML export met cover page die `Omslag_Kop` en `Omslag_ankeiler` classes bevat
**When** de parser wordt uitgevoerd
**Then** worden de cover headlines opgeslagen in `edition.cover_headlines` als JSON array
**And** worden er GEEN artikelen aangemaakt voor cover content (geen ■ op cover)

#### AC3: Meditatie Verse
**Given** een meditatie artikel met `Meditatie_kop-boven-vers` class boven de eigenlijke titel
**When** de parser wordt uitgevoerd
**Then** wordt het vers geëxtraheerd als `chapeau` van het artikel (staat tussen title en ■)
**And** wordt de `Meditatie_Kop-` als article title gebruikt
**And** wordt er slechts 1 artikel aangemaakt (niet 2)

#### AC4: Author Association
**Given** een artikel met title, content, auteur vermelding, en ■
**When** de parser wordt uitgevoerd
**Then** worden alleen auteurs tussen title en ■ geassocieerd met dat artikel
**And** krijgt een artikel NIET auteurs van andere artikelen

#### AC5: Author Bio
**Given** een artikel met auteur onderschrift ("is predikant van...") tussen title en ■
**When** de parser wordt uitgevoerd
**Then** wordt de bio opgeslagen in `article.author_bio`

#### AC6: Chapeau Association
**Given** een artikel met chapeau element tussen title en ■
**When** de parser wordt uitgevoerd
**Then** wordt de chapeau automatisch geassocieerd met dat artikel (geen proximity check nodig)

#### AC7: Auteursfoto Filtering
**Given** een artikel met auteur blok gevolgd door een `<img>` element (auteursfoto)
**When** de parser wordt uitgevoerd
**Then** worden images direct na auteur blokken geïdentificeerd als auteursfoto's
**And** worden deze NIET opgeslagen als article images
**And** worden auteursfoto's correct geassocieerd met de auteur via `author.photo_url`

## Additional Context

### Dependencies

- Prisma migration moet eerst draaien voordat parser wijzigingen werken
- Geen externe dependencies toe te voegen

### Testing Strategy

1. **Unit Tests** voor:
   - `parseSpreadFromFilename()` met single-page mapping
   - `classifyClassName()` met nieuwe patterns (cover-title, intro-verse, author-bio)
   - ■ karakter detectie in `extractElementsFromSpread()`
   - `groupElementsIntoArticles()` met title→■ boundaries
   - `extractCoverMetadata()` functie
   - DOM-based author photo detection

2. **Integration Test**:
   - Parse single-page export van editie
   - Verify: aantal artikelen == aantal ■ karakters (9 in test export)
   - Verify: geen cover artikelen, correcte meditatie, juiste auteurs
   - Test artikel dat over 2+ pagina's loopt (title op pagina X, ■ op pagina Y)

3. **Manual Verification**:
   - Review UI op localhost:3001/review/[edition] na re-parse
   - Check dat elk artikel correct begint en eindigt

### Notes

- **Title + ■ boundaries** elimineert complexe merge/proximity logic - dit is de kern vereenvoudiging
- `mergeMultiSpreadArticles()` kan verwijderd worden na implementatie
- InDesign workflow moet aangepast worden om single-page te exporteren
- Cover content heeft geen ■ marker - apart behandelen
- Geen backward compatibility met spread-based exports
- Bestaande edities moeten opnieuw geëxporteerd en geparsed worden
- Test export beschikbaar in `docs/single-page-export/Naamloos/` (9 artikelen met ■)
