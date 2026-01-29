---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments:
  - product-brief-waarheidsvriend-content-db-2026-01-29.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: media_publishing
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - waarheidsvriend-content-db

**Author:** Joost
**Date:** 2026-01-29

## Executive Summary

**waarheidsvriend-content-db** is een content extractie- en publicatieplatform voor het weekblad De Waarheidsvriend. Het systeem automatiseert de wekelijkse workflow van InDesign-export naar WordPress-publicatie.

**Kernprobleem:** De huidige workflow kost 1-1,5 uur per week aan handmatig werk: afbeeldingen koppelen, HTML-artifacts corrigeren, en data handmatig invoeren.

**Oplossing:** Een geautomatiseerde pipeline die:
- InDesign XHTML-exports parseert naar gestructureerde data
- PDF drukwerkversies converteert naar pagina-afbeeldingen voor visuele verificatie
- Content via REST API beschikbaar stelt aan WordPress

**Doelgebruiker:** Joost (freelance websitebeheerder) — enige gebruiker in v1.

**Kernbelofte:** Reduceer verwerkingstijd van 1-1,5 uur naar 15-30 minuten per editie.

**Tech Stack:** Next.js (SPA), PostgreSQL, Docker.

## Success Criteria

### User Success

- Volledige editie-verwerking binnen 15-30 minuten (inclusief eventuele WordPress-correcties)
- Geen handmatige copy-paste of HTML-opschoning meer nodig
- Artikelen staan direct klaar in WordPress na API-sync

### Business Success

- Wekelijkse tijdsbesparing van ~1 uur
- Betrouwbare, herhaalbare workflow zonder verrassingen
- Fundament voor toekomstige uitbreidingen (nieuwsbrieven, social)

### Technical Success

- Parser extraheert artikelen, afbeeldingen, auteurs correct uit InDesign XHTML
- API levert complete data aan WordPress (content, auteur, categorie, featured image)
- Systeem draait stabiel in Docker-omgeving

### Measurable Outcomes

- 5 edities succesvol verwerkt via het nieuwe systeem
- Geen handmatige HTML-correcties nodig in >90% van artikelen
- WordPress-publicatie werkt zonder handmatige data-invoer

## Product Scope

### MVP (Phase 1)

**MVP Approach:** Problem-solving MVP — focus op kernprobleem met minimale maar complete functionaliteit.

**Must-Have Capabilities:**
- **Upload Interface:** XHTML-exportmap + PDF uploaden
- **Parser Engine:** Artikelen, auteurs, afbeeldingen, structuur extraheren uit XHTML
- **PDF Processor:** PDF-pagina's converteren naar afbeeldingen
- **Database:** PostgreSQL met artikelen, auteurs, edities, pagina-afbeeldingen
- **Review Interface:** Split-view (PDF-spread links, geparsede content rechts)
- **REST API:** Complete artikel-data beschikbaar voor WordPress
- **WordPress Integratie:** Artikelen ophalen en publiceren

### Phase 2 (Growth)

- Edit-interface in eigen systeem (niet meer afhankelijk van WordPress voor correcties)
- Agenda en nieuwsberichten activeren (database-architectuur al voorbereid)
- Bi-directionele sync met WordPress

### Phase 3 (Expansion)

- Nieuwsbrief-generatie vanuit API
- Social media content snippets
- Multi-channel publishing platform

### Risk Mitigation

| Risico | Mitigatie |
|--------|-----------|
| Parser complexiteit bij ongebruikelijke layouts | Begin met subset, itereer op edge cases, accepteer 80-90% correctheid in v1 |
| Scope creep: review → edit interface | Strikte grens: v1 is alleen bekijken, edits in WordPress |
| Parser fouten na publicatie | Visuele review met PDF-vergelijking, correcties in WordPress acceptabel |

## User Journeys

### Journey 1: Wekelijkse Editie Verwerken (Happy Path)

**Opening Scene:**
Dinsdagochtend. Joost ontvangt de InDesign-export en drukwerk-PDF. Deadline: 16:00.

**Rising Action:**
Joost uploadt XHTML-exportmap en PDF. Systeem verwerkt beide — parser extraheert artikelen, PDF wordt opgeknipt in pagina-afbeeldingen. Na 1-2 minuten: klaar.

**Climax:**
In de review-interface bladert Joost door artikelen. Links: PDF-spread. Rechts: geparsede content. Per artikel één oogopslag: titel, auteur, afbeelding — klopt.

**Resolution:**
Na 10 minuten alle ~15 artikelen doorgelopen. Eén vreemde koppeling genoteerd voor WordPress-fix. Content beschikbaar via API. WordPress haalt op, Joost publiceert. Om 11:30 klaar.

### Journey 2: Parser Maakt Fouten (Edge Case)

**Opening Scene:**
Nieuwe editie met experimentele layout. Artikelen over drie pagina's, extra kaders, ontbrekende auteur-vermeldingen.

**Rising Action:**
Upload succesvol. Bij review: artikel mist tweede helft, kader als los artikel geparsed, twee artikelen met "Onbekende auteur".

**Climax:**
Joost noteert problemen. Systeem deed 80% goed — rest is handwerk in WordPress.

**Resolution:**
Totale tijd: 45 minuten. Nog steeds sneller dan oude workflow (1,5 uur). Edge cases genoteerd voor parser-verbeteringen.

### Journey 3: WordPress API Consumptie

**Flow:**
1. WordPress triggert sync (scheduled of handmatig)
2. API-call: "Geef artikelen van editie 2026-05"
3. Response: JSON met titel, content, auteur, categorie, images
4. WordPress verwerkt: posts aanmaken, auteurs koppelen, media uploaden
5. Artikelen als concept-posts klaar voor publicatie

### Journey → Capability Mapping

| Journey | Benodigde Capabilities |
|---------|----------------------|
| Happy Path | Upload interface, PDF-naar-images, Parser engine, Review interface (split-view), API |
| Edge Case | Duidelijke parsing-weergave, Herkenbare "vreemde" items |
| WordPress | REST API, Auteur-endpoints, Media URLs |

## Technical Requirements

### Architecture Overview

**Type:** Interne Single Page Application (SPA) met Next.js App Router.
**Gebruikers:** Eén (Joost) — geen publieke toegang.
**Rendering:** Client-side rendering (geen SSR/SSG nodig).

### Browser Support

- Moderne browsers: Chrome, Firefox, Safari, Edge (laatste 2 versies)
- Geen legacy support (IE11, oude mobile)

### Niet Nodig (Skip)

- SEO optimalisatie
- Real-time WebSocket updates
- WCAG accessibility compliance
- Native app features
- Offline support

### Input Format: XHTML Export

De InDesign-export is een mapstructuur:

```
editie-folder/
├── index.html
└── publication-web-resources/
    ├── css/
    │   ├── idGeneratedStyles.css
    │   └── main.css
    ├── html/
    │   ├── publication.html      # Spread 1 (cover)
    │   ├── publication-1.html    # Spread 2-3
    │   └── ...                   # Per spread één HTML
    ├── image/                    # Alle afbeeldingen
    └── Thumbnails/
```

## Functional Requirements

### Editie Upload & Verwerking

- **FR1:** Joost kan een InDesign XHTML-exportmap uploaden (mapstructuur met HTML, images, CSS)
- **FR2:** Joost kan een PDF (drukwerkversie) van de editie uploaden
- **FR3:** Systeem verwerkt geüploade bestanden automatisch na upload
- **FR4:** Joost kan de verwerkingsstatus zien tijdens het parsen

### Content Parsing

- **FR5:** Systeem verwerkt alle HTML-bestanden uit `/html/` submap (één per spread)
- **FR6:** Systeem extraheert afbeeldingen uit `/image/` submap
- **FR7:** Systeem gebruikt CSS-informatie om content-structuur te interpreteren
- **FR8:** Systeem herkent artikelen die over meerdere spreads lopen
- **FR9:** Systeem extraheert individuele artikelen uit XHTML-export
- **FR10:** Systeem extraheert artikeltitels
- **FR11:** Systeem extraheert artikel-chapeaus
- **FR12:** Systeem extraheert artikel body-content als schone HTML
- **FR13:** Systeem extraheert artikelauteurs
- **FR14:** Systeem extraheert auteursfoto's
- **FR15:** Systeem koppelt afbeeldingen aan artikelen op basis van HTML-referenties
- **FR16:** Systeem leidt paginanummers af uit HTML-bestandsnamen
- **FR17:** Systeem identificeert artikelcategorieën/rubrieken
- **FR18:** Systeem extraheert artikel-introducties/excerpts
- **FR19:** Systeem extraheert kaders als aparte content blocks
- **FR20:** Systeem extraheert tussenkoppen binnen artikelen
- **FR21:** Systeem extraheert streamers (quotes)

### PDF Verwerking

- **FR22:** Systeem converteert PDF-pagina's naar individuele afbeeldingen
- **FR23:** Systeem slaat pagina-afbeeldingen op gekoppeld aan editie
- **FR24:** Systeem associeert pagina-afbeeldingen met artikelen op basis van paginanummers

### Review Interface

- **FR25:** Joost kan een lijst van alle artikelen in een editie bekijken
- **FR26:** Joost kan de geparsede content van een individueel artikel bekijken
- **FR27:** Joost kan de bijbehorende PDF-spread(s) naast een artikel bekijken
- **FR28:** Joost kan navigeren tussen artikelen (vorige/volgende)
- **FR29:** Joost kan zien welke afbeeldingen bij elk artikel horen

### Content API

- **FR30:** WordPress kan alle artikelen voor een specifieke editie ophalen
- **FR31:** WordPress kan individuele artikeldetails ophalen (titel, content, auteur, categorie, afbeeldingen)
- **FR32:** WordPress kan auteurinformatie inclusief foto ophalen
- **FR33:** WordPress kan artikelafbeeldingen en onderschriften ophalen
- **FR34:** WordPress kan artikel featured image ophalen

### Data Management

- **FR35:** Systeem slaat edities op met metadata (editienummer, datum)
- **FR36:** Systeem slaat artikelen op gekoppeld aan hun editie
- **FR37:** Systeem slaat auteurs op met hun profielen en foto's
- **FR38:** Systeem slaat artikel-auteur relaties op
- **FR39:** Systeem slaat afbeeldingen op met metadata en onderschriften
- **FR40:** Systeem slaat pagina-afbeeldingen op gekoppeld aan edities

## Non-Functional Requirements

### Performance

- **NFR1:** Parser verwerkt volledige editie (12 spreads, ~15 artikelen) binnen 2 minuten
- **NFR2:** Review interface laadt artikel-weergave binnen 500ms
- **NFR3:** PDF-naar-images conversie voltooit binnen 1 minuut (24 pagina's)
- **NFR4:** API response tijd <500ms

### Security

- **NFR5:** Systeem alleen toegankelijk vanaf localhost of via authenticatie
- **NFR6:** Database credentials in environment variables (niet in code)

### Integration

- **NFR7:** API volgt REST-conventies voor WordPress compatibiliteit
- **NFR8:** API retourneert JSON in consistent format
- **NFR9:** Afbeelding-URLs direct toegankelijk voor WordPress media imports

### Reliability

- **NFR10:** Parser-fouten stoppen niet gehele verwerking (graceful degradation per artikel)
- **NFR11:** Systeem logt parsing-fouten voor debugging
