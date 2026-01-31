# Claude Code Project Instructions

## Projectstructuur

- `src/services/wordpress/` - WordPress publicatie service
- `src/services/parser/` - XHTML/PDF parsing en artikel extractie
- `scripts/` - CLI scripts voor reparse, publish, import
- `uploads/editions/<id>/` - Editie bestanden (xhtml, images, pdf)

## CLI Scripts

### Re-parse Editie
Verwerk een bestaande editie opnieuw na parser fixes:

```bash
# Dry-run (toon wat er zou gebeuren)
npm run reparse -- --edition=<id> --dry-run

# Daadwerkelijk opnieuw parsen
npm run reparse -- --edition=<id>
```

### Publiceer naar WordPress
Publiceer artikelen naar WordPress:

```bash
# Enkel artikel
npm run publish:wp -- --article=<id>

# Hele editie
npm run publish:wp -- --edition=<id>

# Met dry-run
npm run publish:wp -- --article=<id> --dry-run
```

### Tests draaien
```bash
# Alle tests
npm run test

# Specifieke test file
npm run test -- src/services/wordpress/article-mapper.test.ts

# WordPress service tests
npm run test -- src/services/wordpress/
```

## Database Commando's

### Artikelen zoeken
```bash
# Zoek artikel op titel
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "SELECT id, title, edition_id FROM articles WHERE title ILIKE '%zoekterm%';"

# Artikelen van een editie
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "SELECT id, title FROM articles WHERE edition_id = <id>;"

# Artikelen met quotes/blockquotes
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "SELECT id, title FROM articles WHERE content LIKE '%<blockquote%';"
```

### Edities bekijken
```bash
# Lijst van edities
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "SELECT id, edition_number, edition_date, status FROM editions ORDER BY id DESC LIMIT 10;"
```

### Artikel content bekijken
```bash
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "SELECT content FROM articles WHERE id = <id>;"
```

## Nieuwe Editie Importeren

### 1. Bestanden plaatsen
Zorg dat de XHTML export staat in:
```
uploads/editions/<edition_id>/xhtml/
```

### 2. Editie aanmaken in database
```bash
docker compose exec db psql -U postgres -d waarheidsvriend \
  -c "INSERT INTO editions (id, edition_number, edition_date, status, created_at, updated_at)
      VALUES (<id>, <nummer>, '<YYYY-MM-DD>', 'pending', NOW(), NOW());"
```

### 3. Parsen
```bash
npm run reparse -- --edition=<id>
```

### 4. Publiceren
```bash
npm run publish:wp -- --edition=<id>
```

## Belangrijke Implementatiedetails

### Publicatiedatum
- Artikelen worden gepubliceerd op de `edition_date` uit de database (09:00 Amsterdam tijd)
- Niet meer "volgende donderdag" maar de daadwerkelijke editiedatum uit de PDF
- Zie: `src/services/wordpress/article-mapper.ts` - `formatEditionDateForWp()`

### Quote/Streamer Extractie
- Streamers met CSS-klassen zoals `Artikelen_Streamer-Blauw-Gecentreerd` worden geconverteerd naar `<blockquote>`
- Gedefinieerd in: `src/services/parser/article-extractor.ts`
- CSS-klassen gedetecteerd via: `src/services/parser/structure-analyzer.ts`

### Artikel Splitsing
- Artikelen worden gesplitst op het `■` eindmarker karakter
- Zonder dit marker worden opeenvolgende titels als subtitels behandeld

## Environment Variables

### .env.local (WordPress credentials)
```
NEXT_PUBLIC_WP_API_URL=https://example.com/wp-json/wp/v2
WP_USERNAME=user@example.com
WP_APP_PASSWORD=xxxx
```

### .env (Database)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/waarheidsvriend
```
