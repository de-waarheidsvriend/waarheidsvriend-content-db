# Patronen Overzicht - De Waarheidsvriend HTML Export

## Herkenbare HTML Patronen

| Element | HTML Tag | CSS Class | Positie | Herkenbaarheid |
|---------|----------|-----------|---------|----------------|
| Artikel titel | `<p>` | `Artikelen_Hoofdkop` | Begin artikel | **HOOG** |
| Chapeau (boven titel) | `<p>` | `Artikelen_Chapeau-blauw` | Voor hoofdkop | **HOOG** |
| Streamer/Quote | `<p>` | `Artikelen_Streamer-Blauw-Gecentreerd` | In artikel | **HOOG** |
| Platte tekst | `<p>` | `Hoofdartikel_Platte-tekst` | Artikelinhoud | **HOOG** |
| Intro met grote letter | `<p>` | `Hoofdartikel_Platte-tekst-met-introletter` | Eerste alinea | **HOOG** |
| Tussenkop | `<p>` | `Hoofdartikel_Tussenkop-lichtblauw` | In artikel | **HOOG** |
| Auteur "Tekst:" | `<p>` | `Artikelen_Tekst--geschreven-door` | Na titel | **HOOG** |
| Auteur info blok | `<p>` | `Artikelen_info-auteur` | Einde artikel | **HOOG** |
| Auteur naam | `<span>` | `Onderschrift-auteur_naam-auteur` | In auteur blok | **HOOG** |
| Auteur onderschrift | `<p>` | `Artikelen_Onderschrift-auteur` | Na auteur naam | **HOOG** |
| Fotobijschrift | `<p>` | `Artikelen_Fotobijschrift` | Bij afbeelding | **HOOG** |
| Rubriek kop | `<p>` | `Algemeen_Thema-bondsnieuws` | Begin rubriek | **HOOG** |
| Kader tekst | `<p>` | `Kaders_Platte-tekst-schreefloos` | In kader | **HOOG** |
| Kader tussenkop | `<p>` | `Kaders_Tussenkop` | In kader | **HOOG** |
| TOC item | `<p>` | `Inhoudsopgave_TOC-onderwerp` | Inhoudsopgave | **HOOG** |
| Boektitel recensie | `<p>` | `boekaankondigingen-boekbesprekingen-Muziek_Titel-boek` | Boekrecensie | **HOOG** |
| Boek kadertekst | `<p>` | `boekaankondigingen-boekbesprekingen-Muziek_Kadertekst` | Boekrecensie | **HOOG** |
| Afbeelding container | `<div>` | `Basisafbeeldingskader` | Overal | **HOOG** |
| Tekst container | `<div>` | `Basistekstkader` | Overal | **MEDIUM** |
| Pagina nummer | `<p>` | `Hoofdartikel_Platte-tekst` + CharOverride-23 | Hoek pagina | **MEDIUM** |

## Tekstopmaak Classes (CharOverride)

| Class | Lettertype | Grootte | Stijl | Kleur | Gebruik |
|-------|------------|---------|-------|-------|---------|
| CharOverride-30 | Utopia Std | 190px | Normal | #000000 | Basis lopende tekst |
| CharOverride-31 | Utopia Std | 190px | Italic | #000000 | Italic tekst |
| CharOverride-24 | Depot New Condensed | 880px | Bold | #000000 | Grote koppen |
| CharOverride-56 | Depot New Condensed Lt | 320px | Italic | #0063a3 | Streamers/chapeau |
| CharOverride-61 | Depot New Condensed Lt | 220px | Italic | #0063a3 | Tussenkoppen |
| CharOverride-27 | Depot New Condensed | 170px | Bold | #000000 | "Tekst:" label |
| CharOverride-28 | Depot New Condensed | 170px | Normal | #000000 | Auteursnaam |
| CharOverride-34 | Depot New Condensed | 160px | Bold | #565656 | Auteur in blok |
| CharOverride-11 | Depot New Condensed | 880px | Bold | #0063a3 | "Inhoud" kop |
| CharOverride-69 | Depot New Condensed | 880px | Bold | #ffffff | Witte titel |

## Rubriek Herkenning

| Rubriek | Herkenningspatroon | Betrouwbaarheid |
|---------|---------------------|-----------------|
| Bondsnieuws | `Algemeen_Thema-bondsnieuws` + tekst "Bondsnieuws" | 100% |
| Kerknieuws | `Algemeen_Thema-bondsnieuws` + tekst "Kerknieuws" | 100% |
| Agenda | `Algemeen_Thema-bondsnieuws` + tekst "Agenda" | 100% |
| Boekbespreking | `Algemeen_Thema-bondsnieuws` + tekst "Boekbespreking" | 100% |
| In Memoriam | `Artikelen_Hoofdkop` + tekst "In memoriam" | 95% |
| Column | Pagina 7, korte tekst, geen serie indicator | 80% |
| Serie | `Artikelen_Chapeau-blauw` met serie-naam | 90% |
| Interview | Titel met quotes ('...') | 70% |
| Diepgravend | Via inhoudsopgave "Diepgravend" marker | 85% |

## Afbeelding Patronen

| Type | Src Pattern | Omschrijving |
|------|-------------|--------------|
| Foto artikel | `../image/[naam].jpg` of `.png` | Echte foto |
| Portret auteur | `../image/[Naam]_[Datum].jpg` | Auteursfoto |
| Stock foto | `../image/AdobeStock_*.jpg/png` | Stock afbeelding |
| Advertentie | `../image/Adv_*.png` of `Advertentie_*.png` | Advertentie |
| Decoratief | `data:image/png;base64,...` | Inline decoratie/lijn |
| Logo | `../image/Jaarthema*.png` | Logo/embleem |

## HTML Voorbeeld: Compleet Artikel

```html
<!-- CHAPEAU -->
<p class="Artikelen_Chapeau-blauw ParaOverride-1">
  <span class="CharOverride-56">Poëzieweek </span>
  <span class="CharOverride-56">2026</span>
</p>

<!-- HOOFDKOP -->
<p class="Artikelen_Hoofdkop ParaOverride-1">
  <span class="CharOverride-24">Vijf </span>
  <span class="CharOverride-24">dingen </span>
  <span class="CharOverride-24">die </span>
  <span class="CharOverride-24">je </span>
  <span class="CharOverride-24">niet </span>
  <span class="CharOverride-24">wist </span>
  <span class="CharOverride-24">over </span>
  <span class="CharOverride-24">poëzie </span>
  <span class="CharOverride-24">in </span>
  <span class="CharOverride-24">de </span>
  <span class="CharOverride-24">Bijbel</span>
</p>

<!-- AUTEUR VERMELDING -->
<p class="Artikelen_Tekst--geschreven-door ParaOverride-1">
  <span class="CharOverride-27">Tekst: </span>
  <span class="CharOverride-28">Louis </span>
  <span class="CharOverride-28">Seesing</span>
</p>

<!-- LOPENDE TEKST -->
<p class="Hoofdartikel_Platte-tekst ParaOverride-1">
  <span class="CharOverride-30">Eerste </span>
  <span class="CharOverride-30">zin </span>
  <span class="CharOverride-30">van </span>
  <span class="CharOverride-30">het </span>
  <span class="CharOverride-30">artikel...</span>
</p>

<!-- TUSSENKOP -->
<p class="Hoofdartikel_Tussenkop-lichtblauw ParaOverride-1">
  <span class="CharOverride-61">Cola</span>
</p>

<!-- STREAMER/QUOTE -->
<p class="Artikelen_Streamer-Blauw-Gecentreerd ParaOverride-1">
  <span class="CharOverride-56">Alfabetgedichten </span>
  <span class="CharOverride-56">hielpen </span>
  <span class="CharOverride-56">om </span>
  <span class="CharOverride-56">de </span>
  <span class="CharOverride-56">grote </span>
  <span class="CharOverride-56">daden </span>
  <span class="CharOverride-56">van </span>
  <span class="CharOverride-56">God </span>
  <span class="CharOverride-56">te </span>
  <span class="CharOverride-56">onthouden</span>
</p>

<!-- AUTEUR INFO BLOK (einde artikel) -->
<p class="Artikelen_info-auteur ParaOverride-1">
  <span class="Onderschrift-auteur_naam-auteur CharOverride-34">Louis </span>
  <span class="Onderschrift-auteur_naam-auteur CharOverride-34">Seesing </span>
</p>
<p class="Artikelen_Onderschrift-auteur ParaOverride-1">
  <span class="CharOverride-35">is </span>
  <span class="CharOverride-35">journalist </span>
  <span class="CharOverride-35">en </span>
  <span class="CharOverride-35">schrijver</span>
</p>
```

## HTML Voorbeeld: Rubriek Header

```html
<p class="Algemeen_Thema-bondsnieuws ParaOverride-1">
  <span class="CharOverride-84">Bonds</span>
  <span class="CharOverride-85">nieuws</span>
</p>
```

## HTML Voorbeeld: Boekrecensie

```html
<p class="boekaankondigingen-boekbesprekingen-Muziek_Titel-boek ParaOverride-1">
  <span class="CharOverride-71">John </span>
  <span class="CharOverride-71">Mark </span>
  <span class="CharOverride-71">Comer</span>
</p>

<p class="boekaankondigingen-boekbesprekingen-Muziek_Kadertekst ParaOverride-1">
  <span class="CharOverride-29">Serie </span>
</p>
```

## Positie Berekening

De `style` attributen bevatten absolute posities:

```
position:absolute; top:XXXpx; left:XXXpx;
```

**Reconstructie algoritme:**
1. Verzamel alle spans binnen een `<p>` element
2. Sorteer op `top` waarde (primair)
3. Sorteer op `left` waarde (secundair)
4. Concateneer tekstinhoud met spaties

**Voorbeeld:**
```
Span 1: top:0px, left:0px    -> "Vijf "
Span 2: top:0px, left:100px  -> "dingen "
Span 3: top:50px, left:0px   -> "over "  (nieuwe regel)
```

Resultaat: "Vijf dingen over "
