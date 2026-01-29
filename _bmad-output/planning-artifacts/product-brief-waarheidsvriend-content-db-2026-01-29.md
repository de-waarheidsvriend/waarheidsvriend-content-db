---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - Waarheidsvriend-Architectuur-Visie.md
  - PATRONEN-OVERZICHT.md
  - STRUCTUURANALYSE.md
  - "05 De Waarheidsvriend 5-2/ (voorbeeld export)"
date: 2026-01-29
author: Joost
---

# Product Brief: waarheidsvriend-content-db

## Executive Summary

**waarheidsvriend-content-db** is een content extractie- en publicatieplatform voor het weekblad De Waarheidsvriend. Het systeem automatiseert de wekelijkse workflow van InDesign-export naar gestructureerde database, waardoor publicatie naar WordPress en andere kanalen drastisch wordt versneld.

**Kernbelofte:** Reduceer de wekelijkse verwerkingstijd van 1-1,5 uur naar 15-30 minuten, met hogere accuraatheid en minder handmatige stappen.

---

## Core Vision

### Problem Statement

De huidige workflow voor het publiceren van De Waarheidsvriend content is te arbeidsintensief en foutgevoelig. Elke week kost het 1-1,5 uur om artikelen te verwerken, waarbij:
- Afbeeldingen handmatig aan artikelen gekoppeld moeten worden
- Tekst regelmatig HTML-artifacts bevat die gecorrigeerd moeten worden
- Het proces te veel losse stappen heeft die foutgevoelig zijn
- De bestaande oplossing snel is opgezet zonder solide architectuur, waardoor uitbreiding en AI-assisted development lastig is

### Problem Impact

- **Tijdsverlies:** 4-6 uur per maand aan repetitief handwerk
- **Foutgevoeligheid:** Regelmatige correcties nodig door tekstfouten en verkeerde koppelingen
- **Schaalbaarheid:** Uitbreiding naar nieuwsbrieven en social media is moeilijk met huidige opzet
- **Onderhoudbaarheid:** Bestaande code is niet geschikt voor AI-assisted development

### Why Existing Solutions Fall Short

De huidige zelf-gebouwde oplossing was snel opgezet en mist:
- Een doordachte database-architectuur
- Automatische afbeelding-artikel koppeling
- Betrouwbare tekstreconstructie uit InDesign exports
- Een basis voor multi-channel publishing (WordPress, nieuwsbrieven, social media)

### Proposed Solution

Een nieuw platform met:
1. **Geautomatiseerde parser** die InDesign XHTML-exports omzet naar gestructureerde data
2. **Slimme afbeelding-koppeling** op basis van proximity en context
3. **Confidence scoring** die alleen onzekere items markeert voor review
4. **Gestructureerde database** (PostgreSQL) met focus op artikelen en auteurs
5. **REST API** die content aanbiedt aan WordPress en toekomstige clients
6. **Uitbreidbare architectuur** voor toekomstige nieuwsbrief- en social media-integraties

### Key Differentiators

- **AI-ready architectuur:** Ontworpen voor AI-assisted development en toekomstige AI-validatie
- **Confidence-based review:** Alleen reviewen wat nodig is, niet alles handmatig controleren
- **Content blocks:** Gestructureerde opslag die multi-channel publishing mogelijk maakt
- **API-first:** WordPress haalt data op, systeem pusht niet — flexibel voor meerdere clients
- **Clean slate:** Solide fundament in plaats van patches op bestaande code

---

## Target Users

### Primary Users

**Joost — Freelance Websitebeheerder**

- **Rol:** Freelancer verantwoordelijk voor het beheer van De Waarheidsvriend website
- **Verantwoordelijkheid:** Wekelijks de nieuwe editie-content publiceren naar WordPress
- **Deadline:** Artikelen moeten gepubliceerd zijn voor 16:00 op publicatiedag
- **Huidige pijn:**
  - 1-1,5 uur handwerk per week voor een taak die gestroomlijnd zou moeten zijn
  - Afbeeldingen handmatig koppelen
  - Tekstfouten corrigeren (HTML artifacts)
  - Te veel losse stappen in het proces
- **Gewenste situatie:**
  - Maximaal 15-30 minuten per editie
  - Alleen reviewen waar nodig (confidence-based)
  - Betrouwbare output zonder verrassingen
- **Succesindicator:** "Ik upload de export, controleer de gemarkeerde items, en publiceer — klaar."

### Secondary Users

**Toekomstige teamleden (buiten scope v1)**

In de toekomst kunnen er mogelijk andere gebruikers bijkomen die dezelfde workflow uitvoeren. Het systeem moet daarom:
- Helder en gedocumenteerd zijn
- Geen impliciete kennis vereisen
- Eenvoudig overdraagbaar zijn

### User Journey

**Wekelijkse Workflow (Joost)**

1. **Input:** Ontvang InDesign XHTML-export van de nieuwe editie
2. **Upload:** Upload exportmap naar het systeem
3. **Automatische verwerking:** Systeem parseert en structureert (1-2 min)
4. **Review:** Controleer alleen gemarkeerde items (lage confidence)
5. **Correctie:** Pas waar nodig afbeeldingskoppelingen of tekst aan
6. **Approve:** Markeer als klaar voor publicatie (beschikbaar via API)
7. **WordPress:** Haalt data op en publiceert
8. **Klaar:** Totale tijd: 15-30 minuten (voor 16:00 deadline)

**Aha-moment:** "Het systeem heeft 90% correct gedaan — ik hoef alleen de twijfelgevallen te checken."

---

## Success Metrics

### Gebruikerssucces

**Het systeem is succesvol als:**

1. **Correcte HTML:** Output is nette, geldige HTML
2. **Afbeeldingen + onderschriften:** Correct gekoppeld aan artikelen
3. **Controleerbaarheid:** Review interface toont duidelijk wat er geëxtraheerd is
4. **Tijdsbesparing:** Volledige workflow binnen 30 minuten
5. **WordPress-complete:** Artikelen met auteur (incl. foto) + categorie beschikbaar via API

### Kwaliteitscriteria

| Aspect | Criterium |
|--------|-----------|
| Tekst | Correcte Nederlandse tekst als valide HTML |
| Artikel-afbeeldingen | Correct gekoppeld met onderschrift |
| Auteurs | Correct geëxtraheerd met foto |
| Auteur-afbeelding | Correcte foto bij auteursprofiel |
| Categorie | Automatisch toegewezen op basis van rubriek |
| Structuur | Chapeau, titel, tussenkoppen, streamers correct herkend |
| Kaders | Als apart block-type met kop + beschrijving |
| Introductie | Eerste alinea/excerpt beschikbaar |

### Review Interface Scope (v1)

Alleen voor controle:
- Bekijk geëxtraheerde artikelen
- Controleer artikel-afbeeldingen, auteur + auteursfoto, categorie
- Zie confidence indicators
- Approve voor publicatie (maakt beschikbaar via API)

### Definition of Done (v1)

- [ ] Parser extraheert artikelen, afbeeldingen, auteurs correct
- [ ] Kaders correct als blocks met kop + beschrijving
- [ ] Auteurs geëxtraheerd met foto
- [ ] Categorieën automatisch toegewezen
- [ ] Review interface toont resultaat
- [ ] API levert data voor WordPress
- [ ] WordPress haalt data correct op en publiceert
- [ ] 5 edities succesvol verwerkt

---

## MVP Scope

### Core Features (v1)

**Parser Engine**
- Artikelen extraheren met volledige structuur:
  - Titel, chapeau, introductie, tussenkoppen, streamers
  - Content als HTML blocks
  - Kaders als apart block-type (met kop + beschrijving)
- Afbeeldingen koppelen met onderschriften
- Auteurs extraheren met foto

**Database**
- PostgreSQL met focus op artikelen en auteurs
- Architectuur voorbereid voor agenda/nieuws (niet actief)
- Boekbesprekingen als reguliere artikelen

**API**
- REST API die content aanbiedt
- WordPress leest data uit via API (pull, niet push)
- Flexibel voor toekomstige clients (nieuwsbrieven, etc.)

**Review Interface (Next.js)**
- Bekijk geëxtraheerde artikelen
- Controleer afbeeldingen, auteurs, categorieën
- Confidence indicators
- Approve voor publicatie (maakt beschikbaar via API)

**WordPress Integratie**
- WordPress haalt data op via API
- Artikelen met:
  - Content (HTML)
  - Auteur (koppelen/aanmaken met foto)
  - Categorie (op basis van rubriek)
  - Featured image + onderschrift
  - Introductie/excerpt

### Tech Stack

| Component | Technologie |
|-----------|-------------|
| Frontend/Review Interface | Next.js |
| API | Next.js API routes |
| Database | PostgreSQL (Docker container) |
| Parser | Node.js / TypeScript |
| Development | Docker Compose |
| WordPress | Leest API uit |

### Development Setup

```
docker-compose.yml
├── app (Next.js)
├── db (PostgreSQL)
└── volumes voor data persistentie
```

Snel opstarten met `docker-compose up` voor lokaal testen.

### Out of Scope (v1)

| Feature | Reden | Wanneer |
|---------|-------|---------|
| Edit-interface in systeem | WordPress volstaat voor v1 | v2 |
| Agenda-items | Niet direct nodig, architectuur voorbereid | v2+ |
| Nieuwsberichten | Niet direct nodig, architectuur voorbereid | v2+ |
| Boekbespreking als apart model | Regulier artikel volstaat | Indien nodig |
| Nieuwsbrief-generatie | Multi-channel fase | v3 |
| Social media integratie | Multi-channel fase | v3 |

### MVP Success Criteria

Het MVP is succesvol wanneer:
- [ ] 5 edities succesvol verwerkt binnen 30 minuten elk
- [ ] API levert correcte artikelen met auteur + foto + categorie
- [ ] WordPress haalt data correct op en publiceert
- [ ] Kaders correct weergegeven als blocks
- [ ] Afbeeldingen + onderschriften correct gekoppeld
- [ ] Geen handmatige HTML-correcties nodig

### Future Vision

**v2 — Database als Source of Truth**
- Edit-interface in systeem
- Agenda en nieuwsberichten activeren
- Bi-directionele sync met WordPress

**v3 — Multi-channel**
- Nieuwsbrief-generatie vanuit API
- Social media content snippets
- Externe integraties via dezelfde API
