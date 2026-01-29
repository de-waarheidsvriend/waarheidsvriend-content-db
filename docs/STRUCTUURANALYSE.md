# Structuuranalyse: De Waarheidsvriend (Editie 5-2, 2026)

## 1. Samenvatting

Dit document bevat een export uit Adobe InDesign naar HTML. De structuur is **uitdagend voor automatisering** vanwege:
- Absolute positionering van alle tekstelementen met inline CSS
- Fragmentatie van tekst over meerdere `<span>` elementen
- Geen semantische HTML-structuur (geen echte `<article>`, `<section>` etc.)
- Elke pagina is een apart HTML-bestand

**Positief:** InDesign gebruikt consistente CSS-classes voor content-types, wat parsing mogelijk maakt.

---

## 2. Bestandsstructuur

```
05 De Waarheidsvriend 5-2/
├── index.html                          # Frame container (iframe navigatie)
└── publication-web-resources/
    ├── css/
    │   ├── idGeneratedStyles.css      # InDesign gegenereerde stijlen (227KB)
    │   └── main.css                   # Basis stijlen
    ├── html/
    │   ├── publication.html           # Voorpagina/Cover
    │   ├── publication-1.html         # Pagina 2-3 (Colofon + Inhoud)
    │   ├── publication-2.html         # Pagina 4-5
    │   ├── publication-3.html         # Pagina 6-7
    │   ├── publication-4.html         # Pagina 8-9
    │   ├── publication-5.html         # Pagina 10-11
    │   ├── publication-6.html         # Pagina 12-13
    │   ├── publication-7.html         # Pagina 14-15
    │   ├── publication-8.html         # Pagina 16-17
    │   ├── publication-9.html         # Pagina 18-19
    │   ├── publication-10.html        # Pagina 20-21
    │   ├── publication-11.html        # Pagina 22-23
    │   └── publication-12.html        # Pagina 24 (achterkant)
    ├── image/                          # Alle afbeeldingen (67 bestanden)
    └── Thumbnails/                     # Preview afbeeldingen
```

---

## 3. Content-types Inventarisatie

| Type | Aantal | Herkenbaarheid | CSS Class |
|------|--------|----------------|-----------|
| **Hoofdartikelen** | 6-8 | Hoog | `Artikelen_Hoofdkop`, `Hoofdartikel_Platte-tekst` |
| **Columns** | 1 | Hoog | Titel + korte tekst |
| **Boekbesprekingen** | 2 | Hoog | `boekaankondigingen-boekbesprekingen-Muziek_*` |
| **In Memoriam** | 1 | Hoog | `Artikelen_Hoofdkop` met "In memoriam" |
| **Bondsnieuws** | 1 | Hoog | `Algemeen_Thema-bondsnieuws` met "Bondsnieuws" |
| **Kerknieuws** | 1 | Hoog | `Algemeen_Thema-bondsnieuws` met "Kerknieuws" |
| **Agenda** | 1 | Hoog | `Algemeen_Thema-bondsnieuws` met "Agenda" |
| **Advertenties** | 5+ | Medium | Afbeeldingen zonder tekst-class |
| **Colofon** | 1 | Hoog | Specifieke tekst op pagina 1 |
| **Inhoudsopgave** | 1 | Hoog | `Inhoudsopgave_TOC-onderwerp` |

---

## 4. CSS Classes Overzicht

### 4.1 Artikel Structuur

| Element | CSS Class | Omschrijving |
|---------|-----------|--------------|
| **Artikel Hoofdkop** | `Artikelen_Hoofdkop` | Grote titel van artikel |
| **Chapeau** | `Artikelen_Chapeau-blauw` | Koptekst boven titel |
| **Streamer** | `Artikelen_Streamer-Blauw-Gecentreerd` | Citaat/highlight in artikel |
| **Platte tekst** | `Hoofdartikel_Platte-tekst` | Lopende tekst |
| **Intro letter** | `Hoofdartikel_Platte-tekst-met-introletter` | Eerste alinea met groot eerste letter |
| **Tussenkop** | `Hoofdartikel_Tussenkop-lichtblauw` | Subkop binnen artikel |

### 4.2 Auteur Informatie

| Element | CSS Class | Voorbeeld |
|---------|-----------|-----------|
| **Tekst door** | `Artikelen_Tekst--geschreven-door` | "Tekst: Louis Seesing" |
| **Auteur info** | `Artikelen_info-auteur` | Auteursnaam onderaan |
| **Onderschrift auteur** | `Artikelen_Onderschrift-auteur` | Auteur beschrijving |
| **Naam auteur** | `Onderschrift-auteur_naam-auteur` | Specifiek naam styling |

### 4.3 Afbeeldingen

| Element | CSS Class | Omschrijving |
|---------|-----------|--------------|
| **Afbeeldingskader** | `Basisafbeeldingskader` | Container voor afbeelding |
| **Fotobijschrift** | `Artikelen_Fotobijschrift` | Onderschrift bij foto |

### 4.4 Kaders & Rubrieken

| Element | CSS Class | Omschrijving |
|---------|-----------|--------------|
| **Kader tekst** | `Kaders_Platte-tekst-schreefloos` | Tekst in kader |
| **Kader tussenkop** | `Kaders_Tussenkop` | Kop in kader |
| **Thema header** | `Algemeen_Thema-bondsnieuws` | Rubriek kop (Bondsnieuws, Kerknieuws, etc.) |

### 4.5 Boekrecensies

| Element | CSS Class |
|---------|-----------|
| **Boektitel** | `boekaankondigingen-boekbesprekingen-Muziek_Titel-boek` |
| **Kadertekst** | `boekaankondigingen-boekbesprekingen-Muziek_Kadertekst` |

### 4.6 Inhoudsopgave

| Element | CSS Class |
|---------|-----------|
| **TOC item** | `Inhoudsopgave_TOC-onderwerp` |
| **Chapeau** | `Hoofdartikel_Chapeau-wit` |

---

## 5. HTML Structuur Patronen

### 5.1 Basis Element Structuur

```html
<div id="_idContainerXXX" class="Basistekstkader">
  <div style="...transform: scale(0.05);">
    <p class="[CSS-CLASS] ParaOverride-1">
      <span id="_idTextSpanXXX" class="CharOverride-XX"
            style="position:absolute;top:XXpx;left:XXpx;">
        Tekst fragment
      </span>
      <span>Volgende fragment</span>
    </p>
  </div>
</div>
```

### 5.2 Afbeelding Structuur

```html
<div id="_idContainerXXX" class="Basisafbeeldingskader _idGenObjectStyle-Disabled">
  <img class="_idGenObjectAttribute-1 _idGenObjectAttribute-2"
       src="../image/bestandsnaam.jpg"
       alt="" />
</div>
```

### 5.3 Auteur Patroon

```html
<p class="Artikelen_Tekst--geschreven-door ParaOverride-1">
  <span class="CharOverride-27">Tekst: </span>
  <span class="CharOverride-28">Louis </span>
  <span class="CharOverride-28">Seesing</span>
</p>
```

---

## 6. Artikelen in deze Editie

Op basis van de inhoudsopgave en HTML-analyse:

| Pag. | Titel | Type | Auteur |
|------|-------|------|--------|
| 4 | Blijde boodschap en wettelijke waarden | Hoofdartikel | - |
| 7 | Ruimte om mens te zijn | Column | - |
| 8 | Vijf dingen die je niet wist over poëzie in de Bijbel | Artikel | Louis Seesing |
| 10 | Gods Koninkrijk breekt baan | Serie artikel | - |
| 12 | Discipelschap in een gehaaste tijd | Hoofdartikel | - |
| 15 | Het graf van Jezus | Diepgravend | - |
| 17 | In memoriam ds. W.J. Gorissen | In Memoriam | - |
| 18 | 'God werkt in mijn tekort' | Interview | - |
| 21 | Bondsnieuws | Rubriek | - |
| 21 | Kerknieuws | Rubriek | - |
| 21 | Boekbespreking | Recensie | - |
| 23 | Agenda | Rubriek | - |

---

## 7. Uitdagingen voor Parsing

### 7.1 Tekst Reconstructie
**Probleem:** Tekst is gefragmenteerd over vele `<span>` elementen met absolute positionering.

```html
<!-- "Gods Koninkrijk breekt baan" is verdeeld over 4 spans -->
<span style="left:0px;">Gods </span>
<span style="left:1701.88px;">Koninkrijk </span>
<span style="left:4975.42px;">breekt </span>
<span style="left:7144.56px;">baan</span>
```

**Oplossing:** Spans binnen dezelfde `<p>` samenvoeging in leesorde (links naar rechts, top naar bottom).

### 7.2 Artikel Grenzen
**Probleem:** Geen expliciete start/eind markers voor artikelen.

**Oplossing:** Gebruik `Artikelen_Hoofdkop` als artikel-start marker. Verzamel content tot volgende `Artikelen_Hoofdkop` of pagina-einde.

### 7.3 Afbeelding-Artikel Koppeling
**Probleem:** Afbeeldingen staan niet in dezelfde container als artikeltekst.

**Oplossing:** Gebruik positie-nabijheid (y-coördinaat) en volgorde in document om afbeeldingen aan artikelen te koppelen.

### 7.4 Multi-pagina Artikelen
**Probleem:** Sommige artikelen lopen over meerdere pagina's.

**Oplossing:** Artikelen zonder nieuwe `Artikelen_Hoofdkop` op volgende pagina zijn voortzetting.

---

## 8. Voorgestelde JSON Structuur

```json
{
  "publicatie": {
    "naam": "De Waarheidsvriend",
    "editienummer": "5",
    "jaargang": "2026",
    "datum": "2026-01-29",
    "export_datum": "2026-01-29"
  },
  "rubrieken": [
    {
      "naam": "Hoofdartikelen",
      "volgorde": 1,
      "artikelen": [
        {
          "id": "art-001",
          "type": "hoofdartikel",
          "titel": "Blijde boodschap en wettelijke waarden",
          "chapeau": "Christelijk onderwijs in een seculariserende omgeving",
          "auteur": {
            "naam": null,
            "omschrijving": null
          },
          "pagina_start": 4,
          "pagina_eind": 6,
          "content": {
            "intro": "Eerste alinea met introletter...",
            "paragrafen": [
              {
                "type": "tekst",
                "inhoud": "Lopende tekst..."
              },
              {
                "type": "tussenkop",
                "inhoud": "Subkop titel"
              },
              {
                "type": "streamer",
                "inhoud": "Uitgelichte quote"
              }
            ]
          },
          "afbeeldingen": [
            {
              "bestand": "AdobeStock_831704791.png",
              "onderschrift": null,
              "fotograaf": null,
              "positie_in_artikel": "header"
            }
          ],
          "bronbestand": "publication-2.html"
        }
      ]
    },
    {
      "naam": "Column",
      "volgorde": 2,
      "artikelen": [...]
    },
    {
      "naam": "Serie",
      "volgorde": 3,
      "artikelen": [...]
    },
    {
      "naam": "Diepgravend",
      "volgorde": 4,
      "artikelen": [...]
    },
    {
      "naam": "In Memoriam",
      "volgorde": 5,
      "artikelen": [...]
    },
    {
      "naam": "Interview",
      "volgorde": 6,
      "artikelen": [...]
    },
    {
      "naam": "Boekbespreking",
      "volgorde": 7,
      "artikelen": [...]
    },
    {
      "naam": "Bondsnieuws",
      "volgorde": 8,
      "artikelen": [...]
    },
    {
      "naam": "Kerknieuws",
      "volgorde": 9,
      "artikelen": [...]
    },
    {
      "naam": "Agenda",
      "volgorde": 10,
      "artikelen": [...]
    }
  ],
  "advertenties": [
    {
      "pagina": 24,
      "afbeelding": "advertentie.png",
      "beschrijving": "GZB advertentie"
    }
  ],
  "metadata": {
    "totaal_paginas": 24,
    "totaal_artikelen": 12,
    "totaal_afbeeldingen": 67
  }
}
```

---

## 9. Antwoorden op Kernvragen

### 1. Kunnen we artikelen automatisch detecteren?
**JA** - Door `Artikelen_Hoofdkop` class te gebruiken als start-marker.

### 2. Kunnen we artikeltypen onderscheiden?
**JA** - Door combinatie van:
- `Algemeen_Thema-bondsnieuws` class met tekst (Bondsnieuws, Kerknieuws, etc.)
- `Artikelen_Chapeau-blauw` voor serie-artikelen
- Speciale titels ("In memoriam", "'God werkt...")

### 3. Kunnen we metadata betrouwbaar extraheren?
**GEDEELTELIJK**
- ✅ Titel: Altijd aanwezig in `Artikelen_Hoofdkop`
- ✅ Chapeau: Vaak aanwezig in `Artikelen_Chapeau-blauw`
- ⚠️ Auteur: Niet altijd aanwezig (8 van ~12 artikelen)
- ❌ Datum: Alleen globaal voor editie, niet per artikel
- ✅ Pagina: Afleidbaar uit bestandsnaam

### 4. Kunnen we afbeeldingen koppelen aan artikelen?
**GEDEELTELIJK** - Uitdagend vanwege absolute positionering. Strategie:
- Afbeeldingen direct voor/na artikel-container
- Fotobijschriften met `Artikelen_Fotobijschrift` class

### 5. Kunnen we rubrieken automatisch identificeren?
**JA** - Via `Algemeen_Thema-bondsnieuws` class.

### 6. Wat is het moeilijkste onderdeel?
Reconstructie van **lopende tekst** uit gefragmenteerde spans met absolute positionering.

### 7. Wat is de grootste uitdaging voor automatisering?
**Correcte tekstreconstructie** en **artikel-afbeelding koppeling**.

### 8. Schatting automatisering
- **70%** automatisch (structuur, titels, rubriekherkenning)
- **30%** menselijke review (afbeelding-koppeling, tekst-verificatie)

---

## 10. Aanbevelingen voor Parser

### Fase 1: Basis Extractie
1. Lees alle HTML-bestanden in volgorde
2. Extract alle elementen met relevante CSS-classes
3. Bouw tekst op uit spans (sorteer op position top → left)

### Fase 2: Artikel Identificatie
1. Vind `Artikelen_Hoofdkop` elementen als artikel-starts
2. Groepeer content tot volgende artikel-start
3. Identificeer rubriek via `Algemeen_Thema-bondsnieuws` of context

### Fase 3: Metadata Extractie
1. Zoek auteur in `Artikelen_Tekst--geschreven-door` of `Artikelen_info-auteur`
2. Extract chapeau uit `Artikelen_Chapeau-*`
3. Extract streamers uit `Artikelen_Streamer-*`

### Fase 4: Afbeelding Koppeling
1. Zoek afbeeldingen (niet base64) in zelfde pagina
2. Koppel op basis van positie-nabijheid
3. Extract bijschrift uit `Artikelen_Fotobijschrift`

### Fase 5: Validatie
1. Vergelijk met inhoudsopgave
2. Controleer volledigheid artikelen
3. Markeer onzekere koppelingen voor review

---

## 11. Open Vragen

1. **Advertenties meenemen?** - Moeten advertenties in de JSON of apart?
2. **Tekst formatting behouden?** - Bold/italic uit CharOverride classes halen?
3. **Colofon structuur?** - Aparte verwerking of overslaan?
4. **Cross-validatie?** - Met andere edities vergelijken voor consistentie?

---

## 12. Bijlagen

### A. Alle gevonden CSS Classes (top 30)

| Count | Class |
|-------|-------|
| 7697 | CharOverride-30 (basis tekst) |
| 1521 | CharOverride-52 |
| 229 | CharOverride-31 (italic tekst) |
| 216 | Hoofdartikel_Platte-tekst |
| 200 | CharOverride-8 |
| 174 | CharOverride-67 |
| 136 | Afbeelding attributes |
| 129 | CharOverride-56 (chapeau/streamer) |
| 116 | Basistekstkader |
| 111 | A0 CharOverride-30 |

### B. Lettertype Families

- **Depot New** - Koppen en accenten
- **Utopia Std** - Lopende tekst
- **Courier Prime** - Code/speciaal
- **Minion Pro** - Basis serif

### C. Kleurenpalet

- `#0063a3` - Hoofdkleur blauw
- `#462f65` - Accent paars
- `#6a96aa` - Licht blauw
- `#49afe8` - Helder blauw
- `#565656` - Grijs
- `#ffffff` - Wit
- `#000000` - Zwart
