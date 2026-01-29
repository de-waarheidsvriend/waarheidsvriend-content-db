# Story 1.1: Project Initialisatie

Status: done

## Story

Als developer,
Wil ik een Next.js project opgezet hebben met de juiste configuratie,
Zodat ik kan beginnen met de implementatie van features.

## Acceptance Criteria

1. **Given** een lege project directory
   **When** het project wordt geïnitialiseerd
   **Then** is er een werkend Next.js project met:
   - TypeScript configuratie
   - Tailwind CSS
   - ESLint
   - App Router met `src/` directory
   - Turbopack als dev server
   - Import alias `@/*`

2. **And** de development server start zonder errors op `localhost:3000`

3. **And** het project volgt de directory structuur uit Architecture.md

## Tasks / Subtasks

- [x] Task 1: Next.js project initialiseren (AC: #1)
  - [x] 1.1 Voer het `create-next-app` commando uit met de juiste flags
  - [x] 1.2 Verifieer dat alle configuratiebestanden correct zijn aangemaakt

- [x] Task 2: Directory structuur valideren (AC: #3)
  - [x] 2.1 Controleer aanwezigheid `src/` directory met App Router
  - [x] 2.2 Valideer `tsconfig.json` import alias `@/*`
  - [x] 2.3 Verifieer Tailwind configuratie (Tailwind v4 via postcss.config.mjs)

- [x] Task 3: Development server test (AC: #2)
  - [x] 3.1 Start development server met `npm run dev`
  - [x] 3.2 Verifieer dat applicatie draait op `localhost:3000`
  - [x] 3.3 Controleer console op errors

## Dev Notes

### Initialisatie Commando

Het exacte commando uit Architecture.md:

```bash
npx create-next-app@latest waarheidsvriend-content-db --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"
```

**LET OP:** Het project moet geïnitialiseerd worden IN de huidige repository directory, NIET als nieuwe subdirectory. Dit betekent dat de bestaande `.git` folder en configuratie behouden blijft.

**Oplossing:** Run het commando met `.` als projectnaam of kopieer de gegenereerde bestanden naar de root:

```bash
# Optie 1: Direct in huidige directory
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"

# Optie 2: Genereer tijdelijk en verplaats
npx create-next-app@latest temp-project --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"
# Kopieer alle bestanden behalve .git naar root
```

### Verwachte Bestanden Na Initialisatie

```
waarheidsvriend-content-db/
├── README.md
├── package.json
├── package-lock.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── .gitignore
├── .eslintrc.json
├── public/
│   └── favicon.ico
└── src/
    └── app/
        ├── globals.css
        ├── layout.tsx
        └── page.tsx
```

### Architectuur Compliance

Dit is de eerste story en legt het fundament voor de rest van het project. Alle volgende stories bouwen voort op deze structuur.

**Kritieke Punten:**
- `src/` directory MOET aanwezig zijn (niet root-level app/)
- App Router (niet Pages Router)
- TypeScript (niet JavaScript)
- Import alias `@/*` voor absolute imports

### Project Structure Notes

- Dit is een **greenfield** project — de huidige repository bevat alleen BMAD configuratie en planning artifacts
- Na initialisatie moeten de BMAD folders (`_bmad/`, `_bmad-output/`) behouden blijven
- De `.claude/` folder (Claude Code settings) moet ook behouden blijven

### Potentiële Problemen

1. **Bestaande bestanden:** Als er conflicten zijn met bestaande bestanden, gebruik `--no-src-dir` NIET — we hebben de src directory nodig per Architecture.md

2. **Package manager:** `create-next-app` vraagt mogelijk om package manager keuze — gebruik **npm** voor consistentie

3. **Git:** Het project initialiseert mogelijk een nieuwe git repo — dit is al een git repo, dus skip die stap of verwijder de dubbele `.git`

### References

- [Source: architecture.md#Starter Template Evaluation] - Initialisatie commando
- [Source: architecture.md#Complete Project Directory Structure] - Verwachte structuur
- [Source: architecture.md#Architectural Decisions Provided by Starter] - Technologie keuzes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Geen debug issues tijdens implementatie.

### Completion Notes List

- **Task 1:** Next.js project geïnitialiseerd via tijdelijke directory aanpak (optie 2 uit Dev Notes) omdat directe initialisatie conflicten had met bestaande bestanden. Project is succesvol opgezet met Next.js 16.1.6, React 19.2.3, TypeScript 5, en Tailwind CSS v4.

- **Task 2:** Directory structuur gevalideerd:
  - `src/app/` aanwezig met App Router (layout.tsx, page.tsx, globals.css)
  - Import alias `@/*` correct geconfigureerd in tsconfig.json
  - Tailwind v4 geconfigureerd via `@tailwindcss/postcss` plugin (moderne aanpak, geen aparte tailwind.config.ts nodig)

- **Task 3:** Development server succesvol getest:
  - Server start zonder errors met Turbopack
  - Beschikbaar op localhost:3000
  - "Ready in 478ms" - geen foutmeldingen

**Opmerking:** Tailwind CSS v4 wijkt af van de verwachte v3 structuur in de story. In v4 wordt configuratie gedaan via CSS `@theme` directives in plaats van een aparte `tailwind.config.ts`. Dit is de huidige best practice en voldoet aan de acceptance criteria.

### File List

**Nieuwe bestanden:**
- `package.json` - Project manifest met dependencies
- `package-lock.json` - Dependency lock file
- `tsconfig.json` - TypeScript configuratie met @/* alias
- `next.config.ts` - Next.js configuratie
- `next-env.d.ts` - Next.js TypeScript declaraties
- `postcss.config.mjs` - PostCSS configuratie met Tailwind v4
- `eslint.config.mjs` - ESLint configuratie
- `.gitignore` - Git ignore rules
- `src/app/layout.tsx` - Root layout component
- `src/app/page.tsx` - Homepage component
- `src/app/globals.css` - Global CSS met Tailwind
- `public/` - Public assets directory
- `node_modules/` - Dependencies (gitignored)
- `.next/` - Next.js build cache (gitignored)

### Change Log

- 2026-01-29: Story 1-1 geïmplementeerd - Next.js project initialisatie voltooid met alle acceptance criteria voldaan
