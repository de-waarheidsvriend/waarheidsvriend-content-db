# Architectuur Visie: Waarheidsvriend Content Extractie Platform

**Versie:** 1.0 (Draft)  
**Datum:** 29 januari 2026  
**Auteur:** Claude (Software Architect)  
**Opdrachtgever:** Joost van Schie, Van Schie Software

---

## 1. Executive Summary

### Doel
Wekelijks gestructureerde JSON-data extraheren uit De Waarheidsvriend InDesign-exports voor gebruik in een doorzoekbaar digitaal archief.

### Complexiteitsbeoordeling: MEDIUM
- **Positief:** Consistente CSS-classes maken content-detectie betrouwbaar
- **Uitdagend:** Tekstreconstructie uit gefragmenteerde spans, afbeelding-koppeling
- **Beheersbaar:** Enkele operator (Joost) voor export én review

### Kerngetallen
| Aspect | Waarde |
|--------|--------|
| Automatisering potentieel | ~70-80% |
| Menselijke review nodig | ~20-30% |
| Artikelen per editie | 10-15 |
| Verwerkingstijd per editie | 15-30 min (incl. review) |

### Aanbevolen aanpak
**Gefaseerde implementatie** met een semi-automatisch systeem waarbij:
1. Parser extraheert en structureert automatisch
2. Review-interface toont resultaat voor menselijke validatie
3. Na goedkeuring: opslag in database

---

## 2. Systeem Overzicht

### High-Level Architectuur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WEKELIJKSE WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   InDesign   │───▶│    XHTML     │───▶│    Parser    │───▶│   Review     │
│   Bestand    │    │    Export    │    │   Engine     │    │   Interface  │
│              │    │  (Handmatig) │    │ (Automatisch)│    │  (Handmatig) │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              OPSLAG                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                         │
│  │  Database  │    │ Afbeelding │    │   JSON     │                         │
│  │ (Artikelen)│    │   Storage  │    │  Archief   │                         │
│  └────────────┘    └────────────┘    └────────────┘                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Componenten

| Component | Verantwoordelijkheid | Type |
|-----------|---------------------|------|
| **InDesign Export** | XHTML + afbeeldingen genereren | Handmatig (Joost) |
| **Parser Engine** | HTML parsen, tekst reconstrueren, structuur herkennen | Automatisch |
| **Validator** | Completeness checks, cross-validatie met TOC | Automatisch |
| **Review Interface** | Visuele controle, correcties doorvoeren | Handmatig (Joost) |
| **Database** | Artikelen, metadata, relaties opslaan | Automatisch |
| **Afbeelding Storage** | Afbeeldingen opslaan met referenties | Automatisch |

---

## 3. Workflow Design

### Stap-voor-stap proces

```
FASE 1: VOORBEREIDING (5 min)
├── 1.1 InDesign bestand openen
├── 1.2 Export naar XHTML (met afbeeldingen)
└── 1.3 Export-map uploaden naar systeem

FASE 2: AUTOMATISCHE VERWERKING (1-2 min)
├── 2.1 HTML-bestanden inlezen (in paginavolgorde)
├── 2.2 Tekst reconstrueren uit spans
├── 2.3 Artikelen detecteren (via Artikelen_Hoofdkop)
├── 2.4 Rubrieken classificeren
├── 2.5 Metadata extraheren (auteur, chapeau, etc.)
├── 2.6 Afbeeldingen koppelen (proximity-based)
└── 2.7 Validatie tegen inhoudsopgave

FASE 3: REVIEW (10-20 min)
├── 3.1 Overzicht tonen: gevonden artikelen
├── 3.2 Per artikel: titel, auteur, afbeeldingen controleren
├── 3.3 Problemen markeren (geel = onzeker, rood = fout)
├── 3.4 Handmatige correcties doorvoeren
└── 3.5 Goedkeuren

FASE 4: OPSLAG (automatisch)
├── 4.1 JSON genereren
├── 4.2 Afbeeldingen verplaatsen naar storage
├── 4.3 Database records aanmaken
└── 4.4 Bevestiging
```

### Tijdsinschatting per editie

| Fase | Tijd | Door |
|------|------|------|
| Export uit InDesign | 5 min | Joost |
| Automatische verwerking | 1-2 min | Systeem |
| Review & correcties | 10-20 min | Joost |
| **Totaal** | **~20-30 min** | |

---

## 4. Database Model

### 4.1 Entity Relationship Diagram

Het datamodel bevat 10 tabellen voor complete Waarheidsvriend-extractie:

```
                              ┌─────────────────┐
                              │    AUTEURS      │
                              ├─────────────────┤
                              │ id, naam        │
                              │ naam_normalized │
                              └────────┬────────┘
                                       │ N:1
┌─────────────────┐                    │
│    UITGAVEN     │                    │
├─────────────────┤                    ▼
│ id (PK)         │──┬──────► ┌─────────────────────┐
│ jaargang        │  │        │     ARTIKELEN       │ ◄──┬── boekbesprekingen (1:1)
│ editienummer    │  │        ├─────────────────────┤    │
│ datum           │  │        │ id, uitgave_id      │    ├── kaders (1:N)
│ totaal_paginas  │  │        │ auteur_id           │    │
│ status          │  │        │ rubriek, titel      │    └── afbeeldingen (1:N)
└─────────────────┘  │        │ content_blocks      │
                     │        │ content_plain       │
                     │        └─────────────────────┘
                     │                    ▲
                     │                    │ N:1
                     │        ┌───────────┴───────────┐
                     │        │      VOORPAGINA       │
                     │        │ (3 items per editie)  │
                     │        │ kop, subkop, artikel  │
                     │        └───────────────────────┘
                     │
                     ├──────► advertenties (1:N)
                     ├──────► nieuwsberichten (1:N) — Bondsnieuws/Kerknieuws
                     └──────► agenda_items (1:N) — Evenementen

Totaal: 10 tabellen
─────────────────────────────────────────────────────────────────────────
KERN:        uitgaven, artikelen, auteurs, afbeeldingen
CONTENT:     voorpagina, kaders, boekbesprekingen  
RUBRIEKEN:   nieuwsberichten, agenda_items
OVERIG:      advertenties
```

**Belangrijke ontwerpbeslissingen:**
- `auteur_omschrijving` zit bij ARTIKELEN (artikel-gebonden, niet auteur-gebonden)
- `content_blocks` is JSONB met gestructureerde blokken (zie sectie 4.4)
- Kaders kunnen bij artikel horen OF los staan
- Nieuwsberichten en Agenda zijn GEEN artikelen (apart model)
- Voorpagina items verwijzen naar artikelen (marketing-tekst kan afwijken)

### 4.2 Tabellen Definitie

#### Tabel: `uitgaven`

De hoofdentiteit — één record per weekblad editie.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `jaargang` | INTEGER | NOT NULL | Jaar van publicatie (2026) |
| `editienummer` | INTEGER | NOT NULL | Weeknummer (1-52) |
| `datum` | DATE | NOT NULL | Publicatiedatum |
| `totaal_paginas` | INTEGER | NOT NULL | Aantal pagina's (meestal 24) |
| `totaal_artikelen` | INTEGER | NULL | Geteld na extractie |
| `export_datum` | TIMESTAMP | NOT NULL | Wanneer geëxporteerd uit InDesign |
| `import_datum` | TIMESTAMP | NOT NULL | Wanneer geïmporteerd in systeem |
| `status` | VARCHAR(20) | NOT NULL | 'draft', 'review', 'approved' |
| `review_notes` | TEXT | NULL | Opmerkingen van reviewer |

**Constraints:**
- UNIQUE (jaargang, editienummer)

---

#### Tabel: `auteurs`

Alle auteurs die ooit een artikel hebben geschreven. Wordt automatisch aangevuld.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `naam` | VARCHAR(255) | NOT NULL | Volledige naam |
| `naam_normalized` | VARCHAR(255) | NOT NULL | Lowercase, zonder diacrieten (voor matching) |
| `eerste_publicatie` | DATE | NULL | Datum eerste artikel |
| `laatst_gezien` | DATE | NULL | Datum laatste artikel |
| `artikel_count` | INTEGER | DEFAULT 0 | Aantal artikelen |

**Constraints:**
- UNIQUE (naam_normalized)

**Rationale:** 
- Auteurs worden automatisch aangemaakt bij eerste vermelding
- `naam_normalized` voorkomt duplicaten ("Louis Seesing" vs "louis seesing")
- **Let op:** Omschrijving staat NIET hier — die is artikel-gebonden (zie artikelen tabel)

---

#### Tabel: `artikelen`

Het hart van het systeem — alle artikelcontent.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `artikel_ref` | VARCHAR(30) | NOT NULL | Leesbare ID: "wv-2026-05-art-003" |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `auteur_id` | INTEGER | FK → auteurs | Nullable (niet altijd bekend) |
| `auteur_omschrijving` | TEXT | NULL | Omschrijving **op moment van publicatie** |
| `rubriek` | VARCHAR(50) | NOT NULL | Enum: zie onder |
| `titel` | VARCHAR(500) | NOT NULL | Hoofdtitel |
| `chapeau` | VARCHAR(500) | NULL | Koptekst boven titel |
| `pagina_start` | INTEGER | NOT NULL | Beginpagina |
| `pagina_eind` | INTEGER | NULL | Eindpagina (NULL = zelfde als start) |
| `content_blocks` | JSONB | NOT NULL | **Gestructureerde content** (zie 5.4) |
| `content_plain` | TEXT | NULL | Plain-text versie voor full-text search |
| `bronbestand` | VARCHAR(100) | NOT NULL | "publication-2.html" |
| `extraction_confidence` | DECIMAL(3,2) | NOT NULL | 0.00 - 1.00 |
| `review_status` | VARCHAR(20) | DEFAULT 'pending' | 'pending', 'approved', 'flagged' |
| `review_notes` | TEXT | NULL | Opmerkingen |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Over `content_blocks` (JSONB):**
Content wordt opgeslagen als array van blokken in volgorde, zodat de layout van het blad behouden blijft:
- Paragrafen, tussenkoppen, streamers, afbeeldingen op hun originele positie
- Tekstopmaak (bold/italic/underline) via HTML tags: `<b>`, `<i>`, `<u>`
- Zie sectie 5.4 voor volledig datamodel

**Over `content_plain`:**
Automatisch gegenereerde plain-text versie (zonder HTML tags) voor PostgreSQL full-text search.

**Over `auteur_omschrijving`:**
De omschrijving van de auteur zoals die in *dit specifieke artikel* stond. Bijvoorbeeld:
- Artikel 2024: "is redacteur bij Uitgeverij X"
- Artikel 2026: "is hoofdredacteur bij Organisatie Y"

Beide verwijzen naar dezelfde `auteur_id`, maar met verschillende omschrijvingen.

**Rubriek ENUM:**
```sql
CREATE TYPE rubriek_type AS ENUM (
  'hoofdartikel',
  'column', 
  'serie',
  'diepgravend',
  'in_memoriam',
  'interview',
  'boekbespreking',
  'bondsnieuws',
  'kerknieuws',
  'agenda',
  'overig'
);
```

**Constraints:**
- UNIQUE (artikel_ref)
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE
- FK auteur_id REFERENCES auteurs(id) ON DELETE SET NULL

---

#### Tabel: `afbeeldingen`

Alle afbeeldingen met hun koppeling aan artikelen.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `artikel_id` | INTEGER | FK → artikelen | Gekoppeld artikel |
| `bestandsnaam` | VARCHAR(255) | NOT NULL | "AdobeStock_831704791.png" |
| `bestandspad` | VARCHAR(500) | NOT NULL | Relatief pad naar storage |
| `onderschrift` | TEXT | NULL | Fotobijschrift |
| `fotograaf` | VARCHAR(255) | NULL | Credit |
| `bron` | VARCHAR(100) | NULL | "AdobeStock", "eigen", etc. |
| `positie` | VARCHAR(20) | DEFAULT 'inline' | 'header', 'inline', 'footer' |
| `volgorde` | INTEGER | DEFAULT 1 | Bij meerdere afbeeldingen |
| `breedte` | INTEGER | NULL | Pixels |
| `hoogte` | INTEGER | NULL | Pixels |
| `koppeling_confidence` | DECIMAL(3,2) | NOT NULL | Hoe zeker is de koppeling |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK artikel_id REFERENCES artikelen(id) ON DELETE CASCADE
- INDEX op artikel_id (veel queries zoeken afbeeldingen bij artikel)

---

#### Tabel: `advertenties`

Advertenties worden apart opgeslagen, niet bij de artikelen.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `pagina` | INTEGER | NOT NULL | Op welke pagina |
| `positie_op_pagina` | VARCHAR(30) | NULL | 'heel', 'half_boven', 'half_onder', 'kwart', 'strip' |
| `bestandsnaam` | VARCHAR(255) | NOT NULL | Afbeelding bestandsnaam |
| `bestandspad` | VARCHAR(500) | NOT NULL | Pad naar storage |
| `adverteerder` | VARCHAR(255) | NULL | Naam adverteerder (indien bekend/leesbaar) |
| `beschrijving` | TEXT | NULL | Korte omschrijving van de advertentie |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE
- INDEX op uitgave_id

**Toelichting:**
- Advertenties worden als hele afbeelding opgeslagen (niet geparsed)
- Adverteerder kan handmatig worden ingevuld als dat waardevol is
- Positie_op_pagina helpt bij latere analyse (welke formaten populair etc.)

---

#### Tabel: `voorpagina`

De voorpagina/cover bevat altijd 3 koppen met 3 subkoppen die verwijzen naar hoofdartikelen.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `positie` | INTEGER | NOT NULL | Volgorde op cover (1, 2, of 3) |
| `kop` | VARCHAR(500) | NOT NULL | Hoofdtekst op cover |
| `subkop` | VARCHAR(500) | NULL | Ondertitel/teaser |
| `artikel_id` | INTEGER | FK → artikelen | Verwijzing naar het artikel |
| `afbeelding_id` | INTEGER | FK → afbeeldingen | Cover afbeelding (indien apart) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE
- FK artikel_id REFERENCES artikelen(id) ON DELETE SET NULL
- UNIQUE (uitgave_id, positie)

**Toelichting:**
- Elke editie heeft precies 3 voorpagina items
- Kop/subkop kunnen afwijken van de artikeltitel (marketing-tekst)
- `artikel_id` koppelt naar het bijbehorende artikel in het blad

---

#### Tabel: `kaders`

Kaders zijn tekstvakken binnen of naast artikelen met eigen kop en inhoud.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `artikel_id` | INTEGER | FK → artikelen | Gekoppeld artikel (kan NULL zijn voor losse kaders) |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `pagina` | INTEGER | NOT NULL | Op welke pagina |
| `kader_type` | VARCHAR(30) | NOT NULL | 'info', 'citaat', 'feitelijk', 'verdieping', 'praktisch' |
| `kop` | VARCHAR(255) | NULL | Kaderkop |
| `subkop` | VARCHAR(255) | NULL | Kader subkop |
| `content_blocks` | JSONB | NOT NULL | Inhoud als blokken (zelfde format als artikelen) |
| `content_plain` | TEXT | NULL | Plain-text voor search |
| `bronbestand` | VARCHAR(100) | NOT NULL | HTML bronbestand |
| `extraction_confidence` | DECIMAL(3,2) | DEFAULT 0.80 | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK artikel_id REFERENCES artikelen(id) ON DELETE SET NULL
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE

**Toelichting:**
- Kaders kunnen bij een artikel horen OF los staan
- CSS class `Kaders_Tussenkop` → kop, `Kaders_Platte-tekst-schreefloos` → content
- `kader_type` helpt bij categorisatie (kan later uitgebreid worden)

---

#### Tabel: `boekbesprekingen`

Boekbesprekingen hebben een specifiek format met boekgegevens.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `artikel_id` | INTEGER | FK → artikelen | Gekoppeld artikel |
| `boek_titel` | VARCHAR(500) | NOT NULL | Titel van het besproken boek |
| `boek_auteur` | VARCHAR(255) | NULL | Auteur(s) van het boek |
| `uitgever` | VARCHAR(255) | NULL | Uitgeverij |
| `isbn` | VARCHAR(20) | NULL | ISBN nummer |
| `paginas` | INTEGER | NULL | Aantal pagina's |
| `prijs` | VARCHAR(20) | NULL | Prijs (als string, bijv. "€ 19,95") |
| `jaar` | INTEGER | NULL | Jaar van uitgave |
| `serie` | VARCHAR(255) | NULL | Serie naam indien van toepassing |
| `cover_afbeelding_id` | INTEGER | FK → afbeeldingen | Boekomslag afbeelding |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK artikel_id REFERENCES artikelen(id) ON DELETE CASCADE
- FK cover_afbeelding_id REFERENCES afbeeldingen(id) ON DELETE SET NULL

**Toelichting:**
- CSS class `boekaankondigingen-boekbesprekingen-Muziek_Titel-boek` → boek_titel
- CSS class `boekaankondigingen-boekbesprekingen-Muziek_Kadertekst` → metadata blok
- De recensie-tekst zelf staat in het gekoppelde artikel (content_blocks)

---

#### Tabel: `nieuwsberichten`

Korte nieuwsberichten binnen Bondsnieuws/Kerknieuws rubrieken.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `rubriek` | VARCHAR(30) | NOT NULL | 'bondsnieuws', 'kerknieuws' |
| `kop` | VARCHAR(255) | NULL | Kop van het bericht (niet altijd aanwezig) |
| `content` | TEXT | NOT NULL | Berichttekst |
| `content_html` | TEXT | NULL | Met formatting (bold/italic) |
| `pagina` | INTEGER | NOT NULL | Op welke pagina |
| `volgorde` | INTEGER | NOT NULL | Volgorde binnen rubriek |
| `bronbestand` | VARCHAR(100) | NOT NULL | HTML bronbestand |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE
- INDEX op (uitgave_id, rubriek)

**Toelichting:**
- Nieuwsberichten zijn korte items, geen volwaardige artikelen
- Ze hebben geen auteur, geen afbeeldingen
- Herkend via `Algemeen_Thema-bondsnieuws` class met tekst "Bondsnieuws" of "Kerknieuws"

---

#### Tabel: `agenda_items`

Agenda-evenementen met datum, locatie en beschrijving.

| Kolom | Type | Nullable | Beschrijving |
|-------|------|----------|--------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `uitgave_id` | INTEGER | FK → uitgaven | Welke editie |
| `titel` | VARCHAR(255) | NOT NULL | Naam van het evenement |
| `datum_start` | DATE | NULL | Startdatum |
| `datum_eind` | DATE | NULL | Einddatum (bij meerdaagse events) |
| `tijd` | VARCHAR(50) | NULL | Tijdstip (als string, bijv. "19:30 uur") |
| `locatie` | VARCHAR(255) | NULL | Plaats/adres |
| `organisatie` | VARCHAR(255) | NULL | Organiserende partij |
| `beschrijving` | TEXT | NULL | Extra informatie |
| `contact` | VARCHAR(255) | NULL | Contactgegevens |
| `volgorde` | INTEGER | NOT NULL | Volgorde in agenda |
| `bronbestand` | VARCHAR(100) | NOT NULL | HTML bronbestand |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- FK uitgave_id REFERENCES uitgaven(id) ON DELETE CASCADE
- INDEX op uitgave_id
- INDEX op datum_start

**Toelichting:**
- Agenda items komen uit de "Agenda" rubriek
- Herkend via `Algemeen_Thema-bondsnieuws` class met tekst "Agenda"
- Datums worden geparsed indien mogelijk, anders NULL met beschrijving in tekstveld

---

### 4.3 Database Diagram (Compact)

```
┌─────────────────┐                                           ┌─────────────────┐
│    UITGAVEN     │                                           │    AUTEURS      │
├─────────────────┤                                           ├─────────────────┤
│ id (PK)         │──┐                                        │ id (PK)         │
│ jaargang        │  │                                        │ naam            │
│ editienummer    │  │                                        │ naam_normalized │
│ datum           │  │                                        └────────┬────────┘
│ totaal_paginas  │  │                                                 │
│ status          │  │                                                 │
└─────────────────┘  │                                                 │
                     │                                                 │
   ┌─────────────────┼─────────────────┬─────────────────┐             │
   │                 │                 │                 │             │
   ▼                 ▼                 ▼                 ▼             │
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  VOORPAGINA  │ │ ADVERTENTIES │ │NIEUWSBERICHTEN│ │ AGENDA_ITEMS │    │
├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤    │
│ id (PK)      │ │ id (PK)      │ │ id (PK)      │ │ id (PK)      │    │
│ uitgave_id   │ │ uitgave_id   │ │ uitgave_id   │ │ uitgave_id   │    │
│ positie (1-3)│ │ pagina       │ │ rubriek      │ │ titel        │    │
│ kop          │ │ positie      │ │ kop          │ │ datum_start  │    │
│ subkop       │ │ bestandsnaam │ │ content      │ │ locatie      │    │
│ artikel_id──►│ │ adverteerder │ │ volgorde     │ │ organisatie  │    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
       │                                                               │
       │                                                               │
       ▼                                                               │
┌─────────────────────────┐                                            │
│       ARTIKELEN         │◄───────────────────────────────────────────┘
├─────────────────────────┤
│ id (PK)                 │
│ uitgave_id (FK)         │◄─────────┐
│ auteur_id (FK)          │          │
│ auteur_omschrijving     │          │
│ rubriek                 │          │
│ titel, chapeau          │          │
│ pagina_start/eind       │          │
│ content_blocks (JSONB)  │          │
│ content_plain           │          │
│ extraction_confidence   │          │
│ review_status           │          │
└───────────┬─────────────┘          │
            │                        │
   ┌────────┼────────┐               │
   │        │        │               │
   ▼        ▼        ▼               │
┌────────┐┌────────┐┌────────────────┤
│AFBEELD.││KADERS  ││BOEKBESPREKINGEN│
├────────┤├────────┤├────────────────┤
│id (PK) ││id (PK) ││id (PK)         │
│artik_id││artik_id││artikel_id (FK) │
│bestand ││uitgave ││boek_titel      │
│ondersc.││kop     ││boek_auteur     │
│positie ││subkop  ││uitgever        │
│        ││content ││isbn, prijs     │
│        ││kader_tp││cover_afb_id    │
└────────┘└────────┘└────────────────┘
```

**Relaties Overzicht:**

| Van | Naar | Relatie | Beschrijving |
|-----|------|---------|--------------|
| `uitgaven` | `artikelen` | 1:N | Editie bevat artikelen |
| `uitgaven` | `advertenties` | 1:N | Editie bevat advertenties |
| `uitgaven` | `voorpagina` | 1:3 | Editie heeft exact 3 cover items |
| `uitgaven` | `nieuwsberichten` | 1:N | Editie bevat nieuwsberichten |
| `uitgaven` | `agenda_items` | 1:N | Editie bevat agenda items |
| `artikelen` | `auteurs` | N:1 | Artikel heeft één auteur |
| `artikelen` | `afbeeldingen` | 1:N | Artikel heeft afbeeldingen |
| `artikelen` | `kaders` | 1:N | Artikel kan kaders bevatten |
| `artikelen` | `boekbesprekingen` | 1:1 | Boekbespreking-artikel heeft boekdetails |
| `voorpagina` | `artikelen` | N:1 | Cover item verwijst naar artikel |

---

### 4.4 Content Blocks Schema

De `content_blocks` JSONB kolom in `artikelen` bevat een array van blokken die de structuur van het artikel bewaren:

**Block Types Overzicht:**

| Type | Beschrijving | Velden |
|------|--------------|--------|
| `intro` | Eerste alinea (met introletter in blad) | `text` (met HTML opmaak) |
| `paragraaf` | Normale lopende tekst | `text` (met HTML opmaak) |
| `tussenkop` | Subkop binnen artikel | `text` (plain) |
| `streamer` | Pull quote / uitgelichte tekst | `text` (plain) |
| `citaat` | Blockquote | `text` (met HTML opmaak) |
| `afbeelding` | Inline afbeelding | `afbeelding_id` (FK) |
| `lijst` | Opsomming | `items[]`, `ordered` |
| `kader` | Inline tekstvak | `kop`, `subkop`, `text`, `kader_type` |

**JSON Schema:**

```json
{
  "type": "array",
  "items": {
    "oneOf": [
      {
        "description": "Tekst blok",
        "properties": {
          "type": { "enum": ["intro", "paragraaf", "tussenkop", "streamer", "citaat"] },
          "position": { "type": "integer" },
          "text": { "type": "string", "description": "Tekst met <b>, <i>, <u> tags" }
        },
        "required": ["type", "position", "text"]
      },
      {
        "description": "Afbeelding referentie",
        "properties": {
          "type": { "const": "afbeelding" },
          "position": { "type": "integer" },
          "afbeelding_id": { "type": "integer" }
        },
        "required": ["type", "position", "afbeelding_id"]
      },
      {
        "description": "Lijst blok",
        "properties": {
          "type": { "const": "lijst" },
          "position": { "type": "integer" },
          "items": { "type": "array", "items": { "type": "string" } },
          "ordered": { "type": "boolean", "default": false }
        },
        "required": ["type", "position", "items"]
      },
      {
        "description": "Kader blok (inline tekstvak)",
        "properties": {
          "type": { "const": "kader" },
          "position": { "type": "integer" },
          "kader_type": { "enum": ["info", "citaat", "feitelijk", "verdieping", "praktisch"] },
          "kop": { "type": "string" },
          "subkop": { "type": "string" },
          "text": { "type": "string", "description": "Inhoud met HTML opmaak" }
        },
        "required": ["type", "position", "text"]
      }
    ]
  }
}
```

**Voorbeeld artikel met alle block types:**

```json
[
  {"type": "intro", "position": 1, "text": "De <b>Bijbel</b> staat vol met poëzie..."},
  {"type": "paragraaf", "position": 2, "text": "Gewone tekst met <i>cursief</i> en <u>onderstreept</u>."},
  {"type": "streamer", "position": 3, "text": "Alfabetgedichten hielpen om grote daden te onthouden"},
  {"type": "afbeelding", "position": 4, "afbeelding_id": 42},
  {"type": "tussenkop", "position": 5, "text": "Cola en andere acrostichons"},
  {"type": "paragraaf", "position": 6, "text": "Meer tekst na de tussenkop..."},
  {"type": "kader", "position": 7, "kader_type": "info", "kop": "Wist u dat?", "text": "Het woord 'acrostichon' komt uit het Grieks..."},
  {"type": "citaat", "position": 8, "text": "Een <i>belangrijk</i> citaat uit het artikel."},
  {"type": "lijst", "position": 9, "items": ["Punt één", "Punt twee", "Punt drie"], "ordered": false}
]
```

**Kader vs Kaders tabel - wanneer wat gebruiken?**

| Situatie | Oplossing |
|----------|-----------|
| Klein informatiekader binnen artikelflow | `kader` block type in content_blocks |
| Groot kader met eigen kop/subkop naast artikel | Aparte record in `kaders` tabel |
| Kader dat niet bij specifiek artikel hoort | `kaders` tabel met artikel_id = NULL |

---

### 4.5 Voorbeelddata

```sql
-- Uitgave
INSERT INTO uitgaven (jaargang, editienummer, datum, totaal_paginas, status)
VALUES (2026, 5, '2026-01-29', 24, 'approved');

-- Auteur (automatisch aangemaakt bij eerste artikel)
INSERT INTO auteurs (naam, naam_normalized)
VALUES ('Louis Seesing', 'louis seesing');

-- Artikel (met content_blocks voor rijke structuur)
INSERT INTO artikelen (
  artikel_ref, uitgave_id, auteur_id, auteur_omschrijving, rubriek, titel, chapeau,
  pagina_start, pagina_eind, content_blocks, content_plain, extraction_confidence
) VALUES (
  'wv-2026-05-art-003', 1, 1, 
  'is journalist en schrijver',  -- omschrijving op moment van publicatie
  'hoofdartikel',
  'Vijf dingen die je niet wist over poëzie in de Bijbel',
  'Poëzieweek 2026',
  8, 9,
  '[
    {"type": "intro", "position": 1, "text": "De <b>Bijbel</b> staat vol met poëzie. Niet alleen de Psalmen..."},
    {"type": "paragraaf", "position": 2, "text": "Gewone tekst met <i>cursief</i> en opmaak."},
    {"type": "streamer", "position": 3, "text": "Alfabetgedichten hielpen om grote daden te onthouden"},
    {"type": "afbeelding", "position": 4, "afbeelding_id": 1},
    {"type": "tussenkop", "position": 5, "text": "Cola en andere acrostichons"},
    {"type": "paragraaf", "position": 6, "text": "Meer tekst na de tussenkop..."}
  ]'::jsonb,
  'De Bijbel staat vol met poëzie. Niet alleen de Psalmen... Gewone tekst met cursief en opmaak. Cola en andere acrostichons Meer tekst...',
  0.92
);

-- Zelfde auteur, later artikel, ANDERE omschrijving
INSERT INTO artikelen (
  artikel_ref, uitgave_id, auteur_id, auteur_omschrijving, rubriek, titel,
  pagina_start, content_blocks, content_plain, extraction_confidence
) VALUES (
  'wv-2026-20-art-005', 2, 1,
  'is hoofdredacteur bij Uitgeverij De Banier',  -- nieuwe functie!
  'column',
  'Over woorden en betekenis',
  7,
  '[{"type": "intro", "position": 1, "text": "Taal verandert..."}]'::jsonb,
  'Taal verandert...',
  0.95
);

-- Afbeelding
INSERT INTO afbeeldingen (artikel_id, bestandsnaam, bestandspad, positie, koppeling_confidence)
VALUES (1, 'AdobeStock_831704791.png', '/storage/2026/05/AdobeStock_831704791.png', 'header', 0.85);

-- Advertentie
INSERT INTO advertenties (uitgave_id, pagina, positie_op_pagina, bestandsnaam, bestandspad, adverteerder)
VALUES (1, 23, 'half_onder', 'advertentie-drukkerij.png', '/storage/2026/05/ads/advertentie-drukkerij.png', 'Drukkerij De Banier');

-- ═══════════════════════════════════════════════════════════════════════════════
-- VOORPAGINA (3 items per editie)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO voorpagina (uitgave_id, positie, kop, subkop, artikel_id) VALUES
(1, 1, 'Blijde boodschap en wettelijke waarden', 'Christelijk onderwijs in een seculariserende omgeving', 1),
(1, 2, 'Vijf dingen die je niet wist over poëzie in de Bijbel', 'Poëzieweek 2026', 2),
(1, 3, '''God werkt in mijn tekort''', 'Interview met ds. Henk de Vries', 5);

-- ═══════════════════════════════════════════════════════════════════════════════
-- KADERS (met kop en subkop)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO kaders (artikel_id, uitgave_id, pagina, kader_type, kop, subkop, content_blocks, content_plain, bronbestand)
VALUES (
  1, 1, 5, 'info',
  'Wist u dat?',
  'Feiten over christelijk onderwijs',
  '[
    {"type": "paragraaf", "position": 1, "text": "Nederland telt 1.876 protestants-christelijke basisscholen."},
    {"type": "paragraaf", "position": 2, "text": "Circa <b>27%</b> van alle basisschoolleerlingen bezoekt christelijk onderwijs."},
    {"type": "lijst", "position": 3, "items": ["Reformatorisch: 180 scholen", "Protestants-christelijk: 1.696 scholen"], "ordered": false}
  ]'::jsonb,
  'Nederland telt 1.876 protestants-christelijke basisscholen. Circa 27% van alle basisschoolleerlingen bezoekt christelijk onderwijs.',
  'publication-2.html'
);

-- Kader ZONDER gekoppeld artikel (los kader)
INSERT INTO kaders (artikel_id, uitgave_id, pagina, kader_type, kop, content_blocks, content_plain, bronbestand)
VALUES (
  NULL, 1, 21, 'praktisch',
  'Collecterooster maart 2026',
  '[{"type": "paragraaf", "position": 1, "text": "1 maart - Diaconie\n8 maart - Zending\n15 maart - Kerk"}]'::jsonb,
  'Collecterooster maart 2026: 1 maart - Diaconie, 8 maart - Zending, 15 maart - Kerk',
  'publication-10.html'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BOEKBESPREKINGEN (met alle metadata)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO boekbesprekingen (artikel_id, boek_titel, boek_auteur, uitgever, isbn, paginas, prijs, jaar, serie)
VALUES (
  6,  -- verwijst naar artikel met rubriek='boekbespreking'
  'Discipelschap in een gehaaste tijd',
  'John Mark Comer',
  'Uitgeverij KokBoekencentrum',
  '978-90-435-3456-7',
  288,
  '€ 22,99',
  2025,
  'Praktisch Christelijk Leven'
);

INSERT INTO boekbesprekingen (artikel_id, boek_titel, boek_auteur, uitgever, isbn, paginas, prijs, jaar)
VALUES (
  7,
  'Psalmen voor nu - Nieuwe berijming',
  'Willem Barnard, Jaap Zijlstra e.a.',
  'Boekencentrum',
  '978-90-239-5678-9',
  320,
  '€ 29,95',
  2025
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NIEUWSBERICHTEN (Bondsnieuws / Kerknieuws)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO nieuwsberichten (uitgave_id, rubriek, kop, content, content_html, pagina, volgorde, bronbestand) VALUES
-- Bondsnieuws items
(1, 'bondsnieuws', 'Nieuwe voorzitter Gereformeerde Bond', 
 'Ds. P. de Vries uit Katwijk is benoemd tot nieuwe voorzitter van de Gereformeerde Bond. Hij volgt ds. J. van der Graaf op.',
 'Ds. <b>P. de Vries</b> uit Katwijk is benoemd tot nieuwe voorzitter van de Gereformeerde Bond. Hij volgt ds. J. van der Graaf op.',
 21, 1, 'publication-10.html'),

(1, 'bondsnieuws', 'Ledenvergadering 15 maart',
 'De jaarlijkse ledenvergadering vindt plaats op 15 maart in Amersfoort. Aanmelden kan via de website.',
 'De jaarlijkse ledenvergadering vindt plaats op <b>15 maart</b> in Amersfoort. Aanmelden kan via de website.',
 21, 2, 'publication-10.html'),

-- Kerknieuws items (vaak zonder kop)
(1, 'kerknieuws', NULL,
 'Hervormde Gemeente Barneveld: Beroepen ds. A.J. Mensink te Woudenberg.',
 '<b>Hervormde Gemeente Barneveld:</b> Beroepen ds. A.J. Mensink te Woudenberg.',
 21, 1, 'publication-10.html'),

(1, 'kerknieuws', NULL,
 'Hervormde Gemeente Zeist: Aangenomen het beroep naar Utrecht (Tuindorp).',
 '<b>Hervormde Gemeente Zeist:</b> Aangenomen het beroep naar Utrecht (Tuindorp).',
 21, 2, 'publication-10.html');

-- ═══════════════════════════════════════════════════════════════════════════════
-- AGENDA ITEMS (evenementen)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO agenda_items (uitgave_id, titel, datum_start, datum_eind, tijd, locatie, organisatie, beschrijving, contact, volgorde, bronbestand) VALUES
(1, 'Reformatieherdenking', '2026-03-10', NULL, '19:30 uur',
 'Grote Kerk, Dordrecht', 'Gereformeerde Bond',
 'Spreker: prof. dr. W.H. Dekker. Thema: Luther en de Psalmen.',
 'info@gereformeerdebond.nl', 1, 'publication-11.html'),

(1, 'Jongerenweekend ''Geloven in 2026''', '2026-04-17', '2026-04-19', NULL,
 'De Betteld, Zelhem', 'HGJB',
 'Voor jongeren van 16-25 jaar. Kosten: € 75,- inclusief verblijf en maaltijden.',
 'weekend@hgjb.nl', 2, 'publication-11.html'),

(1, 'Theologische studiedag', '2026-03-28', NULL, '10:00 - 16:00 uur',
 'TU Apeldoorn', 'Theologische Universiteit',
 'Onderwerp: Hermeneutiek en hedendaags Bijbellezen. Toegang gratis, aanmelden verplicht.',
 NULL, 3, 'publication-11.html'),

(1, 'Zendingsdag GZB', '2026-05-09', NULL, '10:00 uur',
 'Barneveld', 'GZB',
 'Jaarlijkse ontmoetingsdag met zendelingen. Kinderactiviteiten aanwezig.',
 'www.gzb.nl', 4, 'publication-11.html');
```

### 4.6 Handige Queries

```sql
-- Alle artikelen van een auteur (met omschrijving per artikel)
SELECT a.titel, u.datum, a.rubriek, a.auteur_omschrijving
FROM artikelen a
JOIN uitgaven u ON a.uitgave_id = u.id
WHERE a.auteur_id = (SELECT id FROM auteurs WHERE naam = 'Louis Seesing')
ORDER BY u.datum DESC;

-- Voorbeeld output:
-- titel                          | datum      | rubriek      | auteur_omschrijving
-- Over woorden en betekenis      | 2026-05-15 | column       | is hoofdredacteur bij Uitgeverij De Banier
-- Vijf dingen over poëzie        | 2026-01-29 | hoofdartikel | is journalist en schrijver
-- (je ziet de carrière-ontwikkeling!)

-- Artikelen die review nodig hebben
SELECT a.titel, a.extraction_confidence, u.editienummer
FROM artikelen a
JOIN uitgaven u ON a.uitgave_id = u.id
WHERE a.review_status = 'pending'
  AND a.extraction_confidence < 0.8;

-- Statistieken per rubriek
SELECT rubriek, COUNT(*) as aantal
FROM artikelen
GROUP BY rubriek
ORDER BY aantal DESC;

-- Full-text zoeken (PostgreSQL)
SELECT titel, ts_rank(to_tsvector('dutch', content_body), query) as rank
FROM artikelen, plainto_tsquery('dutch', 'poëzie bijbel') query
WHERE to_tsvector('dutch', content_body) @@ query
ORDER BY rank DESC;

-- Auteur met alle verschillende omschrijvingen over tijd
SELECT 
  aut.naam,
  a.auteur_omschrijving,
  MIN(u.datum) as eerste_gebruik,
  MAX(u.datum) as laatste_gebruik,
  COUNT(*) as artikelen_met_deze_omschrijving
FROM auteurs aut
JOIN artikelen a ON a.auteur_id = aut.id
JOIN uitgaven u ON a.uitgave_id = u.id
WHERE aut.naam = 'Louis Seesing'
GROUP BY aut.naam, a.auteur_omschrijving
ORDER BY eerste_gebruik;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUERIES VOOR NIEUWE TABELLEN
-- ═══════════════════════════════════════════════════════════════════════════════

-- Voorpagina met gekoppelde artikelen
SELECT 
  vp.positie,
  vp.kop,
  vp.subkop,
  a.titel AS artikel_titel,
  a.pagina_start
FROM voorpagina vp
LEFT JOIN artikelen a ON vp.artikel_id = a.id
WHERE vp.uitgave_id = 1
ORDER BY vp.positie;

-- Alle kaders bij een artikel
SELECT 
  k.kop,
  k.subkop,
  k.kader_type,
  k.content_plain
FROM kaders k
WHERE k.artikel_id = 1
ORDER BY k.pagina;

-- Boekbesprekingen met volledige info
SELECT 
  b.boek_titel,
  b.boek_auteur,
  b.uitgever,
  b.prijs,
  a.titel AS recensie_titel,
  aut.naam AS recensent
FROM boekbesprekingen b
JOIN artikelen a ON b.artikel_id = a.id
LEFT JOIN auteurs aut ON a.auteur_id = aut.id
WHERE a.uitgave_id = 1;

-- Nieuwsberichten per rubriek
SELECT 
  rubriek,
  kop,
  content,
  volgorde
FROM nieuwsberichten
WHERE uitgave_id = 1
ORDER BY rubriek, volgorde;

-- Aankomende agenda items (volgende 3 maanden)
SELECT 
  titel,
  datum_start,
  tijd,
  locatie,
  organisatie
FROM agenda_items
WHERE datum_start BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months'
ORDER BY datum_start;

-- Statistieken per uitgave (complete overview)
SELECT 
  u.editienummer,
  u.datum,
  COUNT(DISTINCT a.id) AS artikelen,
  COUNT(DISTINCT k.id) AS kaders,
  COUNT(DISTINCT nb.id) AS nieuwsberichten,
  COUNT(DISTINCT ai.id) AS agenda_items,
  COUNT(DISTINCT adv.id) AS advertenties
FROM uitgaven u
LEFT JOIN artikelen a ON a.uitgave_id = u.id
LEFT JOIN kaders k ON k.uitgave_id = u.id
LEFT JOIN nieuwsberichten nb ON nb.uitgave_id = u.id
LEFT JOIN agenda_items ai ON ai.uitgave_id = u.id
LEFT JOIN advertenties adv ON adv.uitgave_id = u.id
GROUP BY u.id
ORDER BY u.datum DESC;
```

### 4.7 Indexen (Performance)

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- ARTIKELEN & KERN TABELLEN
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_artikelen_auteur ON artikelen(auteur_id);
CREATE INDEX idx_artikelen_uitgave ON artikelen(uitgave_id);
CREATE INDEX idx_artikelen_rubriek ON artikelen(rubriek);
CREATE INDEX idx_artikelen_content_fts ON artikelen 
  USING GIN(to_tsvector('dutch', content_plain));
CREATE INDEX idx_afbeeldingen_artikel ON afbeeldingen(artikel_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NIEUWE TABELLEN
-- ═══════════════════════════════════════════════════════════════════════════════
-- Voorpagina
CREATE INDEX idx_voorpagina_uitgave ON voorpagina(uitgave_id);
CREATE INDEX idx_voorpagina_artikel ON voorpagina(artikel_id);

-- Kaders
CREATE INDEX idx_kaders_uitgave ON kaders(uitgave_id);
CREATE INDEX idx_kaders_artikel ON kaders(artikel_id);
CREATE INDEX idx_kaders_type ON kaders(kader_type);
CREATE INDEX idx_kaders_content_fts ON kaders 
  USING GIN(to_tsvector('dutch', content_plain));

-- Boekbesprekingen
CREATE INDEX idx_boekbesprekingen_artikel ON boekbesprekingen(artikel_id);
CREATE INDEX idx_boekbesprekingen_boek_fts ON boekbesprekingen 
  USING GIN(to_tsvector('dutch', boek_titel || ' ' || COALESCE(boek_auteur, '')));

-- Nieuwsberichten
CREATE INDEX idx_nieuwsberichten_uitgave ON nieuwsberichten(uitgave_id);
CREATE INDEX idx_nieuwsberichten_rubriek ON nieuwsberichten(rubriek);
CREATE INDEX idx_nieuwsberichten_content_fts ON nieuwsberichten 
  USING GIN(to_tsvector('dutch', content));

-- Agenda items
CREATE INDEX idx_agenda_uitgave ON agenda_items(uitgave_id);
CREATE INDEX idx_agenda_datum ON agenda_items(datum_start);
CREATE INDEX idx_agenda_organisatie ON agenda_items(organisatie);
```

### 4.8 Wat NIET in de database

| Item | Waar dan wel | Reden |
|------|--------------|-------|
| CSS class mappings | Code/config file | Verandert zelden, hoort bij parser logica |
| Parsing regels | Code | Business logic, niet data |
| HTML templates | Code | Deployment, niet runtime data |
| Originele HTML | Filesystem | Te groot, alleen nodig voor debugging |

---

### 4.9 CSS Herkenningspatronen (Parser Referentie)

Deze sectie documenteert hoe de parser elk content type herkent.

#### Voorpagina / Cover
- **Bronbestand:** `publication.html` (eerste bestand in export)
- **Koppen:** Grote tekst elementen met specifieke positionering
- **Subkoppen:** Kleinere tekst direct onder koppen
- **Parsing strategie:** Extract 3 koppen + 3 subkoppen op basis van visuele posities

#### Kaders
| Element | CSS Class | Voorbeeld |
|---------|-----------|-----------|
| Kaderkop | `Kaders_Tussenkop` | "Wist u dat?" |
| Kaderinhoud | `Kaders_Platte-tekst-schreefloos` | Lopende tekst |
| Container | `Basistekstkader` | `<div>` wrapper |

**Herkenning:** Zoek `Basistekstkader` containers met daarin `Kaders_*` classes.

#### Boekbesprekingen
| Element | CSS Class |
|---------|-----------|
| Boektitel | `boekaankondigingen-boekbesprekingen-Muziek_Titel-boek` |
| Auteur/metadata | `boekaankondigingen-boekbesprekingen-Muziek_Kadertekst` |
| Rubriekkop | `Algemeen_Thema-bondsnieuws` met tekst "Boekbespreking" |

**Metadata parsing uit kadertekst:**
```
John Mark Comer               → boek_auteur
Discipelschap in een...       → boek_titel (reeds apart)
KokBoekencentrum, 288 blz.    → uitgever, paginas
€ 22,99                       → prijs
ISBN 978-90-435-3456-7        → isbn
```

#### Nieuwsberichten (Bondsnieuws / Kerknieuws)
| Element | Herkenning |
|---------|------------|
| Rubriekkop | `Algemeen_Thema-bondsnieuws` + tekst "Bondsnieuws" of "Kerknieuws" |
| Berichtkop | Eerste bold tekst na rubriekkop (optioneel) |
| Berichtinhoud | Lopende tekst tot volgende bold of rubriekwissel |

**Kerknieuws patroon:**
- Vaak geen kop, begint direct met gemeente naam in bold
- Format: **"Hervormde Gemeente [Plaats]:"** gevolgd door bericht

#### Agenda Items
| Element | Herkenning |
|---------|------------|
| Rubriekkop | `Algemeen_Thema-bondsnieuws` + tekst "Agenda" |
| Evenementtitel | Bold tekst aan begin item |
| Datum | Patroon: `\d{1,2}\s+(januari|februari|maart|...)\s+\d{4}` of `\d{1,2}-\d{1,2}-\d{4}` |
| Tijd | Patroon: `\d{1,2}[.:]\d{2}\s*uur` |
| Locatie | Na "in" of "te" of op eigen regel |

**Parsing volgorde voor agenda:**
1. Detecteer rubriek via CSS class
2. Split in individuele items (vaak gescheiden door witregel of bold)
3. Extract datum (parse naar DATE indien mogelijk)
4. Extract tijd (bewaar als string)
5. Extract locatie en organisatie
6. Rest = beschrijving

---

## 5. Data Model (JSON Output)

### Verfijnd JSON Schema

Het aangeleverde JSON-schema is een goede basis. Ik stel de volgende aanpassingen voor:

#### 6.1 Toevoegingen

```json
{
  "artikel": {
    "id": "wv-2026-05-art-001",
    "extraction_confidence": {
      "overall": 0.95,
      "titel": 1.0,
      "auteur": 0.85,
      "afbeelding_koppeling": 0.70,
      "tekst_reconstructie": 0.95
    },
    "review_status": "approved",
    "review_notes": null,
    "bron": {
      "html_bestanden": ["publication-2.html", "publication-3.html"],
      "extractie_timestamp": "2026-01-29T14:30:00Z"
    }
  }
}
```

**Rationale:**
- `extraction_confidence`: Maakt duidelijk waar review nodig is
- `review_status`: Tracking van goedkeuring
- `bron`: Traceerbaarheid naar origineel

#### 6.2 Artikel ID Structuur

```
wv-{jaargang}-{editienummer}-art-{volgnummer}
Voorbeeld: wv-2026-05-art-003
```

Hiermee zijn artikelen uniek identificeerbaar over alle edities.

#### 6.3 Rubriek Classificatie

| Rubriek | Detectiemethode | Betrouwbaarheid |
|---------|-----------------|-----------------|
| Bondsnieuws | `Algemeen_Thema-bondsnieuws` + "Bondsnieuws" | 100% |
| Kerknieuws | `Algemeen_Thema-bondsnieuws` + "Kerknieuws" | 100% |
| Agenda | `Algemeen_Thema-bondsnieuws` + "Agenda" | 100% |
| Boekbespreking | CSS class + "Boekbespreking" | 100% |
| In Memoriam | Titel begint met "In memoriam" | 95% |
| Column | Pagina 7 + korte lengte | 80% → **review nodig** |
| Serie | Chapeau met serie-naam | 90% |
| Interview | Titel met quotes | 70% → **review nodig** |

---

## 6. Kwaliteitsstrategie

### 6.1 Drie Validatielagen

```
┌─────────────────────────────────────────────────────────────────┐
│ LAAG 1: AUTOMATISCHE VALIDATIE                                  │
├─────────────────────────────────────────────────────────────────┤
│ • Aantal artikelen matcht inhoudsopgave                         │
│ • Alle titels uit TOC gevonden                                  │
│ • Geen lege content velden                                      │
│ • Afbeeldingen bestaan (file check)                             │
│ • Geen duplicate artikel IDs                                    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAAG 2: CONFIDENCE SCORING                                      │
├─────────────────────────────────────────────────────────────────┤
│ • Tekstreconstructie: Check op rare patronen                    │
│ • Auteur: Gevonden via bekende CSS class? Score = 1.0           │
│ • Afbeelding: Proximity < 500px? Score = 0.9                    │
│ • Rubriek: Expliciete marker? Score = 1.0                       │
│                                                                 │
│ Items met score < 0.8 → MARKEREN VOOR REVIEW                    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAAG 3: MENSELIJKE REVIEW                                       │
├─────────────────────────────────────────────────────────────────┤
│ • Alle gemarkeerde items controleren                            │
│ • Steekproef van "zekere" items (1-2 per editie)                │
│ • Visuele vergelijking met origineel PDF                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Inhoudsopgave als Ground Truth

De TOC (via `Inhoudsopgave_TOC-onderwerp`) bevat:
- Artikeltitels
- Paginanummers

**Cross-validatie:**
1. Extract TOC als eerste stap
2. Vergelijk gevonden artikelen met TOC
3. Missende titels → ERROR
4. Extra artikelen → WARNING (mogelijk advertorial/kader)

### 6.3 Wat markeert het systeem voor review?

| Situatie | Actie |
|----------|-------|
| Afbeelding >300px van dichtstbijzijnde artikel | ⚠️ Review koppeling |
| Auteur niet gevonden | ⚠️ Review (kan bewust ontbreken) |
| Rubriek onzeker (Column, Interview) | ⚠️ Bevestig classificatie |
| Tekst met rare karakters (encoding?) | ⚠️ Controleer reconstructie |
| Artikel over >2 pagina's | ℹ️ Informatie (check volledigheid) |

---

## 7. Automatisering vs. Menselijk Werk

### Verdeling

```
┌────────────────────────────────────────────────────────────────────┐
│                    AUTOMATISERING (70-80%)                         │
├────────────────────────────────────────────────────────────────────┤
│ ✓ HTML parsing en tekstreconstructie                               │
│ ✓ Artikel detectie via CSS classes                                 │
│ ✓ Rubriek classificatie (hoge betrouwbaarheid)                     │
│ ✓ Metadata extractie (titel, chapeau, tussenkop, streamer)         │
│ ✓ Auteur extractie (waar aanwezig)                                 │
│ ✓ Afbeelding-artikel koppeling (eerste poging)                     │
│ ✓ Validatie tegen TOC                                              │
│ ✓ JSON generatie                                                   │
│ ✓ Database opslag                                                  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    MENSELIJKE REVIEW (20-30%)                      │
├────────────────────────────────────────────────────────────────────┤
│ ○ Afbeelding-artikel koppeling bevestigen                          │
│ ○ Onzekere rubriek classificaties                                  │
│ ○ Ontbrekende auteurs toevoegen (indien bekend)                    │
│ ○ Edge cases en uitzonderingen                                     │
│ ○ Finale goedkeuring per editie                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    HANDMATIG BLIJFT (niet automatiseerbaar)        │
├────────────────────────────────────────────────────────────────────┤
│ ✗ InDesign → XHTML export                                          │
│ ✗ Hoge-resolutie afbeeldingen selecteren (indien gewenst)          │
│ ✗ Creatieve beslissingen (wat is "het" hoofdartikel?)              │
└────────────────────────────────────────────────────────────────────┘
```

### Review Interface Requirements

Minimaal benodigde functies:

1. **Overzicht per editie**
   - Lijst van gevonden artikelen met confidence scores
   - Visuele indicatie: groen (OK), geel (review), rood (probleem)

2. **Artikel detail view**
   - Titel, auteur, rubriek (editable)
   - Gekoppelde afbeeldingen met thumbnails
   - Mogelijkheid om afbeelding los te koppelen / te herkoppelen

3. **Side-by-side vergelijking**
   - Geëxtraheerde content naast originele PDF/HTML
   - Snel kunnen checken of tekst correct is

4. **Bulk acties**
   - "Alles goedkeuren" (voor edities zonder warnings)
   - "Markeer voor later" (skip en ga door)

---

## 8. Afbeeldingen Strategie

### Het dilemma

| Optie | Voordeel | Nadeel |
|-------|----------|--------|
| **A: Lage-res uit HTML** | Simpel, automatisch | Kwaliteit onvoldoende voor hergebruik |
| **B: Originelen matchen** | Hoge kwaliteit | Complex, cropping ontbreekt |
| **C: Handmatig selecteren** | Perfecte kwaliteit | Tijdrovend |

### Aanbevolen aanpak: Hybride

**Fase 1 (nu):** Gebruik lage-res afbeeldingen uit HTML-export
- Voldoende voor archief en zoeken
- Minimale complexiteit

**Fase 2 (later, optioneel):** Hoge-res workflow
- Bij publicatie naar website: handmatig juiste afbeelding selecteren
- Of: InDesign script ontwikkelen dat crop-info exporteert

### Afbeelding Metadata

```json
{
  "afbeelding": {
    "bestand_lowres": "image/AdobeStock_831704791.png",
    "bestand_highres": null,
    "breedte": 800,
    "hoogte": 600,
    "onderschrift": "Foto: Voorbeeld onderschrift",
    "fotograaf": null,
    "bron": "AdobeStock",
    "koppeling_confidence": 0.85
  }
}
```

---

## 9. AI-Integratie Strategie

### 9.1 Visie: AI als Tweede Reviewer

Het systeem wordt zo ontworpen dat AI (Claude) op twee manieren kan worden ingezet:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI-READY ARCHITECTUUR                               │
└─────────────────────────────────────────────────────────────────────────────┘

     FASE 1 (Nu)                    FASE 2 (Later)
     ───────────                    ──────────────
     Parser + Menselijke Review     Parser + AI Review + Menselijke Goedkeuring

┌──────────┐    ┌──────────┐       ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Parser  │───▶│  Review  │       │  Parser  │───▶│    AI    │───▶│  Review  │
│          │    │  (Joost) │       │          │    │ Validatie│    │  (Joost) │
└──────────┘    └──────────┘       └──────────┘    └──────────┘    └──────────┘
                                                         │
                                                         ▼
                                                   ┌──────────┐
                                                   │ Patroon  │
                                                   │ Learning │
                                                   └──────────┘
```

### 9.2 AI-Validatiestap

**Wanneer:** Bij items met confidence < 0.8 of bij gemarkeerde problemen

**Wat AI kan doen:**

| Taak | Input voor AI | Output |
|------|---------------|--------|
| **Afbeelding-koppeling valideren** | Afbeelding + omliggende tekst + artikeltitel | "Past bij artikel" / "Hoort elders" |
| **Rubriek classificeren** | Artikeltekst + titel + context | Rubriek suggestie + confidence |
| **Auteur identificeren** | Volledige artikeltekst | Gevonden auteur of "niet aanwezig" |
| **Tekst-reconstructie checken** | Gereconstrueerde tekst + raw HTML | "Correct" / "Probleem bij: ..." |
| **Artikelgrenzen valideren** | Twee opeenvolgende content-blokken | "Zelfde artikel" / "Nieuw artikel" |

**Voorbeeld prompt voor afbeelding-validatie:**

```
Je bent een redactie-assistent voor het weekblad De Waarheidsvriend.

Artikel titel: "Vijf dingen die je niet wist over poëzie in de Bijbel"
Artikel chapeau: "Poëzieweek 2026"
Artikel eerste alinea: "De Bijbel staat vol met poëzie..."

Afbeelding: [beschrijving of base64]
Afbeelding onderschrift: "Psalmen werden gezongen in de tempel"

Vraag: Hoort deze afbeelding bij dit artikel?
Antwoord met: JA / NEE / ONZEKER + korte uitleg
```

### 9.3 Zelf-lerend Patroonsysteem

**Probleem:** Het blad evolueert — nieuwe rubrieken, gewijzigde CSS classes, andere opmaak.

**Oplossing:** AI-assisted configuratie updates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PATROON DETECTIE WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

1. DETECTIE
   Parser vindt element met onbekende CSS class
   → Log naar "unknown_patterns.json"

2. ANALYSE (AI)
   Claude krijgt:
   - Onbekende class + HTML context
   - Bestaande class mappings
   - Voorbeelden van bekende patronen
   
   Claude suggereert:
   - "Dit lijkt op rubriek-header, vergelijkbaar met Algemeen_Thema-bondsnieuws"
   - "Nieuwe class toevoegen aan config: { class: 'Nieuwe_Class', type: 'rubriek_header' }"

3. GOEDKEURING (Menselijk)
   Joost reviewt AI-suggestie
   → Goedkeuren / Aanpassen / Afwijzen

4. UPDATE
   Configuratie wordt uitgebreid
   → Volgende editie herkent dit patroon automatisch
```

### 9.4 AI-Ready Data Structuur

Om AI effectief te kunnen inzetten, moet de data "leesbaar" zijn. Dit betekent:

**Principe 1: Context meegeven**

```json
{
  "artikel": {
    "id": "wv-2026-05-art-003",
    "titel": "Vijf dingen over poëzie",
    
    "extraction_context": {
      "vorige_artikel_titel": "Ruimte om mens te zijn",
      "volgende_artikel_titel": "Gods Koninkrijk breekt baan",
      "pagina_context": "Pagina 8-9, midden van blad",
      "rubriek_indicators_gevonden": ["Poëzieweek 2026"],
      "onzekerheden": [
        {
          "type": "afbeelding_koppeling",
          "beschrijving": "Stock foto van boeken, 450px van artikel",
          "confidence": 0.65
        }
      ]
    }
  }
}
```

**Principe 2: Raw data bewaren**

```json
{
  "artikel": {
    "content_clean": "De Bijbel staat vol met poëzie...",
    
    "content_raw": {
      "html_fragment": "<p class='Hoofdartikel_Platte-tekst'>...",
      "span_positions": [
        {"text": "De", "top": 100, "left": 50},
        {"text": "Bijbel", "top": 100, "left": 80}
      ]
    }
  }
}
```

**Principe 3: Beslissingen loggen**

```json
{
  "extraction_decisions": [
    {
      "decision": "artikel_grens",
      "at": "publication-3.html:line-245",
      "reason": "Artikelen_Hoofdkop gevonden",
      "confidence": 1.0
    },
    {
      "decision": "afbeelding_koppeling", 
      "image": "AdobeStock_831704791.png",
      "to_article": "art-003",
      "reason": "proximity: 120px, same page",
      "confidence": 0.85,
      "needs_review": false
    },
    {
      "decision": "rubriek_classificatie",
      "article": "art-003",
      "assigned": "Hoofdartikel",
      "reason": "geen expliciete rubriek marker, default",
      "confidence": 0.7,
      "needs_review": true
    }
  ]
}
```

### 9.5 Configuratie Structuur (AI-Uitbreidbaar)

```json
{
  "pattern_config": {
    "version": "1.2",
    "last_updated": "2026-01-29",
    "updated_by": "AI-suggestion + human approval",
    
    "article_markers": {
      "start_indicators": [
        {"class": "Artikelen_Hoofdkop", "confidence": 1.0, "note": "Primaire artikel start"},
        {"class": "Algemeen_Thema-bondsnieuws", "confidence": 1.0, "note": "Rubriek header"}
      ]
    },
    
    "rubriek_mappings": [
      {
        "rubriek": "Bondsnieuws",
        "detection": {"class": "Algemeen_Thema-bondsnieuws", "text_contains": "Bondsnieuws"},
        "confidence": 1.0
      },
      {
        "rubriek": "Column",
        "detection": {"page": 7, "max_length": 2000},
        "confidence": 0.8,
        "note": "Onzeker - altijd review"
      }
    ],
    
    "unknown_classes_log": [
      {
        "class": "Nieuwe_Onbekende_Class",
        "first_seen": "2026-02-05",
        "occurrences": 3,
        "context_samples": ["<p class='Nieuwe_Onbekende_Class'>..."],
        "ai_suggestion": null,
        "status": "pending_analysis"
      }
    ]
  }
}
```

### 9.6 Implementatie Fasering AI

| Fase | Wat | Wanneer |
|------|-----|---------|
| **Nu (Fase 1-4)** | AI-ready datastructuur, logging van beslissingen | Mee-ontwerpen |
| **Later (Fase 5)** | AI-validatie bij lage confidence items | Na basis werkt |
| **Toekomst (Fase 6)** | Automatische patroon-suggesties door AI | Na voldoende data |

### 9.7 Voordelen van deze aanpak

1. **Geen blocker:** AI-integratie is optioneel, systeem werkt ook zonder
2. **Geleidelijke adoptie:** Begin met menselijke review, voeg AI toe waar nuttig
3. **Transparant:** Alle AI-beslissingen worden gelogd en zijn reviewbaar
4. **Zelf-verbeterend:** Systeem wordt slimmer naarmate meer edities verwerkt worden
5. **Fallback:** Bij twijfel altijd terug naar menselijke review

---

## 10. Risico's en Mitigaties

### Risico Matrix

| Risico | Kans | Impact | Mitigatie |
|--------|------|--------|-----------|
| **Tekstreconstructie faalt** | Medium | Hoog | Fallback: toon raw HTML + handmatig |
| **Blad-structuur verandert** | Medium | Medium | Configureerbare CSS class mappings |
| **Afbeelding verkeerd gekoppeld** | Hoog | Medium | Altijd review, confidence scoring |
| **Multi-pagina artikel gemist** | Laag | Hoog | TOC validatie vangt dit |
| **Encoding problemen** | Laag | Laag | UTF-8 normalisatie in parser |
| **Performance bij grote edities** | Laag | Laag | 24 pagina's is beheersbaar |

### Grootste risico: Tekstreconstructie

De gefragmenteerde spans met absolute positionering is de technisch lastigste uitdaging.

**Mitigatie strategie:**
1. Sorteer spans op `top` → `left` binnen elke `<p>`
2. Voeg tekstfragmenten samen met spatie
3. Detecteer "rare" patronen (dubbele spaties, losse letters)
4. Bij confidence < 0.7 → markeer voor review
5. Fallback: toon originele HTML naast reconstructie

---

## 11. Implementatie Roadmap

### Fase 1: Proof of Concept (1-2 weken)

**Doel:** Valideer dat de parser werkt voor één editie

- [ ] Basis HTML parser bouwen
- [ ] Tekstreconstructie algoritme implementeren
- [ ] Artikel detectie (alleen Artikelen_Hoofdkop)
- [ ] JSON output genereren
- [ ] Test met editie 5-2

**Deliverable:** Werkende parser die JSON produceert

### Fase 2: Volledigheid (2-3 weken)

**Doel:** Alle content types en metadata

- [ ] Rubriek classificatie toevoegen
- [ ] Alle metadata extractie (auteur, chapeau, etc.)
- [ ] Afbeelding koppeling (proximity-based)
- [ ] TOC extractie en validatie
- [ ] Confidence scoring implementeren

**Deliverable:** Complete extractie met kwaliteitsscores

### Fase 3: Review Interface (2-3 weken)

**Doel:** Praktisch bruikbaar systeem

- [ ] Simpele web interface voor review
- [ ] Artikel editor (correcties doorvoeren)
- [ ] Afbeelding herkoppeling
- [ ] Goedkeuring workflow

**Deliverable:** Werkend end-to-end systeem

### Fase 4: Database & Opslag (1-2 weken)

**Doel:** Persistente opslag

- [ ] Database schema ontwerpen
- [ ] Afbeelding storage inrichten
- [ ] Import van goedgekeurde edities
- [ ] Basis zoekfunctie

**Deliverable:** Doorzoekbaar archief

### Fase 5: AI-Validatie (optioneel, 1-2 weken)

**Doel:** AI-assisted review voor onzekere items

- [ ] Claude API integratie
- [ ] Prompts voor validatietaken
- [ ] AI-suggesties in review interface
- [ ] Logging van AI-beslissingen

**Deliverable:** AI-assisted review workflow

### Fase 6: Patroon Learning (toekomst)

**Doel:** Zelf-lerend systeem

- [ ] Onbekende patronen detectie
- [ ] AI-analyse van nieuwe classes
- [ ] Configuratie update workflow
- [ ] Feedback loop

**Deliverable:** Adaptief systeem

### Tijdlijn Totaal

```
Week 1-2:   [████████] Proof of Concept
Week 3-5:   [████████████] Volledigheid  
Week 6-8:   [████████████] Review Interface
Week 9-10:  [████████] Database & Opslag
────────────────────────────────────────
Basis systeem: ~10 weken

(Optioneel, later)
Week 11-12: [████████] AI-Validatie
Toekomst:   [░░░░░░░░] Patroon Learning
```

---

## 12. Open Vragen & Beslispunten

### Beslissingen genomen

| # | Vraag | Beslissing | Toelichting |
|---|-------|------------|-------------|
| 1 | Database keuze | **PostgreSQL** | Makkelijkst, goed voor JSON, full-text search |
| 2 | Advertenties meenemen? | **Ja, apart** | Aparte tabel, niet bij artikelen |
| 3 | Tekstformattering bewaren? | **Ja** | Bold, italic, underline behouden |
| 4 | Content formaat | **Structured blocks** | Zie sectie 4.4 |
| 5 | Colofon verwerken? | **Nee** | Statische info, overslaan |
| 6 | Review interface | **Web-based** | Joost heeft al basis gebouwd |
| 7 | Afbeelding resolutie | **Lage-res eerst** | Hoge-res later toevoegen |

---

## 13. Conclusie & Advies

### Go/No-Go Assessment

| Criterium | Beoordeling |
|-----------|-------------|
| Technische haalbaarheid | ✅ Haalbaar |
| Accuraatheid haalbaar | ✅ Met review: ja |
| Tijdsinvestering redelijk | ✅ ~10 weken dev, ~30 min/editie |
| ROI positief | ✅ Na ~20 edities terugverdiend |

### Aanbeveling: **GO**

Het project is technisch haalbaar met een semi-automatische aanpak. De consistente CSS-classes in de InDesign-export maken dit veel beter automatiseerbaar dan gemiddelde HTML-scraping projecten.

**Kritische succesfactoren:**
1. Tekstreconstructie-algoritme moet goed werken
2. Review interface moet gebruiksvriendelijk zijn (Joost is enige gebruiker)
3. Confidence scoring moet betrouwbaar "onzekere" items markeren

**Start met:** Proof of Concept (Fase 1) om het tekstreconstructie-probleem te valideren. Als dat werkt, is de rest relatief straightforward.

---

*Document gegenereerd: 29 januari 2026*
