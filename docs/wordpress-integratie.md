# WordPress Integratie - De Waarheidsvriend

Deze documentatie beschrijft de exacte koppeling met de WordPress website van de Gereformeerde Bond voor het publiceren van artikelen.

---

## Verbindingsgegevens

### WordPress Website

| Gegeven | Waarde |
|---------|--------|
| Website | `https://gereformeerdebond.nl` |
| REST API URL | `https://gereformeerdebond.nl/wp-json/wp/v2` |
| GraphQL URL | `https://gereformeerdebond.nl/graphql` (niet gebruikt) |

### Authenticatie

| Gegeven | Waarde |
|---------|--------|
| Methode | Basic Authentication |
| Username | WordPress gebruikersnaam of e-mailadres |
| Password | Application Password (te genereren in WordPress) |

### Environment Variables

```env
NEXT_PUBLIC_WP_API_URL=https://gereformeerdebond.nl/wp-json/wp/v2
WP_USERNAME=jouw-wordpress-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

---

## API Endpoint

### Custom Post Type: `wv-articles`

Artikelen worden gepubliceerd naar een custom post type genaamd `wv-articles`.

| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| POST | `/wp-json/wp/v2/wv-articles` | Nieuw artikel aanmaken |
| PUT | `/wp-json/wp/v2/wv-articles/{id}` | Artikel updaten |
| GET | `/wp-json/wp/v2/wv-articles?slug={slug}` | Artikel ophalen op slug |
| GET | `/wp-json/wp/v2/wv-articles/{id}` | Artikel ophalen op ID |

---

## Data Structuur

### Request Body voor Nieuw Artikel

```json
{
  "title": "Titel van het artikel",
  "slug": "url-vriendelijke-slug",
  "status": "draft",
  "date_gmt": "2026-02-06T08:00:00.000Z",
  "acf": {
    "article_type": "default",
    "article_intro": "Inleiding tekst",
    "article_subtitle": "Ondertitel",
    "article_author": 23,
    "article_image": 456,
    "components": [
      { ... }
    ]
  }
}
```

### Velden Uitleg

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `title` | string | Ja | Titel van het artikel |
| `slug` | string | Ja | URL-slug (alleen kleine letters, cijfers, streepjes) |
| `status` | string | Ja | Altijd `"draft"` voor nieuwe artikelen |
| `date_gmt` | string | Ja | Publicatiedatum in GMT (ISO 8601 formaat) |
| `acf` | object | Ja | ACF velden (zie hieronder) |

---

## ACF Velden Structuur

### Hoofd ACF Object

```typescript
{
  article_type: string;        // "default" of "memoriam"
  article_intro: string;       // Inleiding/intro tekst
  article_subtitle: string;    // Ondertitel
  article_author?: number;     // WordPress User ID van de auteur
  article_image?: number;      // WordPress Media ID voor featured image
  components: Component[];     // Array van content componenten
}
```

### ACF Velden Tabel

| Veld | Type | Beschrijving |
|------|------|--------------|
| `article_type` | string | Type artikel: `"default"` of `"memoriam"` |
| `article_intro` | string | Introductie/samenvatting van het artikel |
| `article_subtitle` | string | Ondertitel (optioneel) |
| `article_author` | number | WordPress User ID van de auteur |
| `article_image` | number | WordPress Media ID voor uitgelichte afbeelding |
| `components` | array | Flexible Content veld met artikel inhoud |

---

## Components (Flexible Content)

Het `components` veld is een ACF Flexible Content veld met de volgende layouts:

### 1. Text Component

```json
{
  "acf_fc_layout": "text",
  "text_text": "<p>HTML inhoud van de tekst...</p>"
}
```

| Veld | Type | Beschrijving |
|------|------|--------------|
| `acf_fc_layout` | string | Altijd `"text"` |
| `text_text` | string | HTML inhoud (WYSIWYG) |

### 2. Quote Component

```json
{
  "acf_fc_layout": "quote",
  "quote_text": "De tekst van het citaat",
  "quote_author": "Naam van de auteur"
}
```

| Veld | Type | Beschrijving |
|------|------|--------------|
| `acf_fc_layout` | string | Altijd `"quote"` |
| `quote_text` | string | Tekst van het citaat |
| `quote_author` | string | Naam/bron van het citaat |

### 3. Image Component

```json
{
  "acf_fc_layout": "text_image",
  "text_image_text": "Bijschrift bij de afbeelding",
  "text_image_image": "https://example.com/image.jpg",
  "text_image_position": "center"
}
```

| Veld | Type | Beschrijving |
|------|------|--------------|
| `acf_fc_layout` | string | Altijd `"text_image"` |
| `text_image_text` | string | Bijschrift/caption |
| `text_image_image` | string | URL van de afbeelding |
| `text_image_position` | string | Positie: `"center"`, `"left"`, `"right"` |

### 4. Paywall Component

```json
{
  "acf_fc_layout": "paywall",
  "paywall_message": "Dit artikel is alleen beschikbaar voor abonnees"
}
```

| Veld | Type | Beschrijving |
|------|------|--------------|
| `acf_fc_layout` | string | Altijd `"paywall"` |
| `paywall_message` | string | Bericht voor niet-abonnees |

---

## Artikel Input Formaat

De applicatie verwacht artikelen in het volgende JSON formaat:

```typescript
interface ArticleData {
  // Verplichte velden
  slug: string;              // URL-slug (kleine letters, cijfers, streepjes)
  titel: string;             // Titel van het artikel
  categorie: string;         // Categorie/rubriek
  content: ArticleContent[]; // Array van content blokken

  // Optionele velden
  subtitel?: string;         // Ondertitel
  auteur?: string;           // Naam van de auteur
  author_id?: number;        // WordPress User ID
  inleiding?: string;        // Introductie tekst
  featured_image?: number;   // WordPress Media ID
  wordpress_post_id?: number; // Bestaand post ID (voor updates)
}

interface ArticleContent {
  type: 'text' | 'quote' | 'paywall' | 'image';
  content?: string;    // Tekst inhoud
  caption?: string;    // Bijschrift (voor images)
  url?: string;        // URL (voor images)
  author?: string;     // Auteur (voor quotes)
}
```

### Voorbeeld Artikel JSON

```json
{
  "slug": "geloof-in-de-praktijk",
  "titel": "Geloof in de Praktijk",
  "subtitel": "Een reflectie op dagelijks geloven",
  "auteur": "Ds. J. van der Berg",
  "author_id": 23,
  "categorie": "meditatie",
  "inleiding": "Hoe kunnen we ons geloof in de praktijk brengen?",
  "featured_image": 456,
  "content": [
    {
      "type": "text",
      "content": "<p>Het geloof is niet alleen een kwestie van woorden...</p>"
    },
    {
      "type": "quote",
      "content": "Geloof zonder werken is dood.",
      "author": "Jakobus 2:26"
    },
    {
      "type": "paywall",
      "content": "Lees verder met een abonnement op De Waarheidsvriend"
    },
    {
      "type": "text",
      "content": "<p>De praktische toepassing van geloof begint bij...</p>"
    }
  ]
}
```

---

## Mapping van Input naar ACF

De transformatie van `ArticleData` naar WordPress ACF:

```typescript
// Input artikel
{
  titel: "Mijn Artikel",
  slug: "mijn-artikel",
  subtitel: "Ondertitel hier",
  inleiding: "Intro tekst",
  categorie: "meditatie",
  author_id: 23,
  featured_image: 456,
  content: [
    { type: "text", content: "<p>Tekst</p>" },
    { type: "quote", content: "Citaat", author: "Auteur" }
  ]
}

// Wordt naar WordPress gestuurd als:
{
  title: "Mijn Artikel",
  slug: "mijn-artikel",
  status: "draft",
  date_gmt: "2026-02-06T08:00:00.000Z",
  acf: {
    article_type: "default",
    article_intro: "Intro tekst",
    article_subtitle: "Ondertitel hier",
    article_author: 23,
    article_image: 456,
    components: [
      {
        acf_fc_layout: "text",
        text_text: "<p>Tekst</p>"
      },
      {
        acf_fc_layout: "quote",
        quote_text: "Citaat",
        quote_author: "Auteur"
      }
    ]
  }
}
```

### Mapping Regels

| Input veld | ACF veld | Opmerking |
|------------|----------|-----------|
| `titel` | `title` | WordPress post title |
| `slug` | `slug` | WordPress post slug |
| `subtitel` | `acf.article_subtitle` | |
| `inleiding` | `acf.article_intro` | Fallback naar `omschrijving_van_auteur` |
| `author_id` | `acf.article_author` | Alleen als aanwezig |
| `featured_image` | `acf.article_image` | Alleen als number |
| `categorie` | `acf.article_type` | "memoriam" → "memoriam", anders "default" |

### Content Type Mapping

| Input type | ACF layout | Velden |
|------------|------------|--------|
| `text` | `text` | `text_text` = content |
| `quote` | `quote` | `quote_text` = content, `quote_author` = author |
| `image` | `text_image` | `text_image_image` = url, `text_image_text` = caption |
| `paywall` | `paywall` | `paywall_message` = content |

---

## Publicatie Datum

Artikelen worden automatisch ingepland voor publicatie op:

**Volgende donderdag om 09:00 Nederlandse tijd**

De code houdt automatisch rekening met:
- Zomer/wintertijd (Europe/Amsterdam timezone)
- Als het al donderdag is en na 09:00, wordt volgende week donderdag gebruikt

---

## Authenticatie Implementatie

### HTTP Header

```
Authorization: Basic <base64-encoded-credentials>
```

### Code Voorbeeld

```typescript
const username = process.env.WP_USERNAME;
const password = process.env.WP_APP_PASSWORD;

const credentials = `${username}:${password}`;
const authHeader = 'Basic ' + Buffer.from(credentials).toString('base64');

const response = await fetch('https://gereformeerdebond.nl/wp-json/wp/v2/wv-articles', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authHeader
  },
  body: JSON.stringify(postData)
});
```

---

## Application Password Aanmaken

1. Log in op WordPress Admin: `https://gereformeerdebond.nl/wp-admin`
2. Ga naar **Gebruikers → Profiel**
3. Scroll naar **Application Passwords**
4. Voer een naam in (bijv. "Artikel API")
5. Klik op **Nieuw applicatiewachtwoord toevoegen**
6. **Kopieer het wachtwoord direct** (wordt maar 1x getoond)

Formaat: `xxxx xxxx xxxx xxxx xxxx xxxx` (spaties optioneel)

---

## Validatie Regels

### Verplichte Velden

- `titel` - Mag niet leeg zijn
- `slug` - Mag niet leeg zijn, alleen `[a-z0-9-]` toegestaan
- `content` - Minimaal één component

### Waarschuwingen (geen errors)

- Artikel zonder auteur
- Artikel zonder inleiding
- Content component zonder inhoud (behalve images)

### Content Validatie

- `image` type vereist een `url`
- Elk content item moet een `type` hebben

---

## Response van WordPress

### Succesvolle Response

```json
{
  "id": 12345,
  "date": "2026-02-06T09:00:00",
  "date_gmt": "2026-02-06T08:00:00",
  "slug": "geloof-in-de-praktijk",
  "status": "draft",
  "link": "https://gereformeerdebond.nl/wv-articles/geloof-in-de-praktijk/",
  "title": {
    "rendered": "Geloof in de Praktijk"
  },
  "acf": {
    "article_type": "default",
    "article_intro": "...",
    "components": [...]
  }
}
```

### Error Response

```json
{
  "code": "rest_cannot_create",
  "message": "Je hebt geen rechten om posts te maken.",
  "data": {
    "status": 403
  }
}
```

---

## Implementatie Stappen

### 1. Environment Variables Instellen

Maak een `.env` bestand:

```env
NEXT_PUBLIC_WP_API_URL=https://gereformeerdebond.nl/wp-json/wp/v2
WP_USERNAME=jouw-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### 2. Dependencies Installeren

```bash
npm install dotenv
```

### 3. API Service Implementeren

Kopieer de service uit `article-to-wp/src/services/wordpressApi.ts` of implementeer de volgende functies:

- `mapArticleToACF(article)` - Transformeer artikel naar ACF formaat
- `validateArticle(article)` - Valideer verplichte velden
- `createWordPressPost(article)` - Maak nieuw artikel
- `updateWordPressPost(postId, article)` - Update bestaand artikel
- `checkArticleExists(slug)` - Controleer of artikel al bestaat

### 4. Types Definiëren

Kopieer de types uit `article-to-wp/src/types/wordpress.ts`:

- `ArticleData` - Input formaat
- `ArticleContent` - Content blok
- `ACFField` - ACF structuur
- `WordPressPost` - WordPress response

### 5. Test de Verbinding

```typescript
// Test authenticatie
const response = await fetch(`${WP_API_URL}/users/me`, {
  headers: { 'Authorization': authHeader }
});

if (response.ok) {
  const user = await response.json();
  console.log(`Verbonden als: ${user.name}`);
}
```

---

## Checklist

- [ ] WordPress credentials ontvangen
- [ ] `.env` bestand aangemaakt
- [ ] `.env` toegevoegd aan `.gitignore`
- [ ] API service geïmplementeerd
- [ ] Types gedefinieerd
- [ ] Verbinding getest met `/users/me`
- [ ] Test artikel aangemaakt als draft
- [ ] Artikel zichtbaar in WordPress admin
