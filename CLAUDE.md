# Claude Code Project Instructions

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
# Enkele artikel
npm run publish:wp -- --article=<id>

# Hele editie
npm run publish:wp -- --edition=<id>

# Met dry-run
npm run publish:wp -- --article=<id> --dry-run
```
