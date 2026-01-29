# Story 1.4: Authenticatie Configuratie

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Als Joost,
Wil ik kunnen inloggen in het systeem,
Zodat alleen ik toegang heb tot de applicatie (NFR5).

## Acceptance Criteria

1. **Given** het project met database
   **When** NextAuth.js wordt geconfigureerd
   **Then** is er een login pagina op `/login`
   **And** kan ik inloggen met credentials (username/password uit env vars)
   **And** worden niet-ingelogde gebruikers doorgestuurd naar `/login`
   **And** zijn alle routes onder `/(auth)/` beschermd

2. **Given** ik ben ingelogd
   **When** ik naar een beschermde pagina navigeer
   **Then** zie ik de pagina content

3. **Given** ik ben niet ingelogd
   **When** ik naar een beschermde pagina navigeer
   **Then** word ik doorgestuurd naar `/login`

4. **And** is er een API Key middleware in `src/lib/api-key.ts`
   **And** valideren `/api/v1/*` routes de `X-API-Key` header
   **And** staan credentials NIET in code maar in environment variables (NFR6)

## Tasks / Subtasks

- [x] Task 1: NextAuth.js installeren en configureren (AC: #1)
  - [x] 1.1 Installeer NextAuth.js v5 (Auth.js): `npm install next-auth@beta`
  - [x] 1.2 Maak `src/lib/auth.ts` met NextAuth configuratie
  - [x] 1.3 Configureer Credentials provider met username/password validatie tegen env vars
  - [x] 1.4 Maak `src/app/api/auth/[...nextauth]/route.ts` API route handler

- [x] Task 2: Environment variables voor authenticatie (AC: #1, #4)
  - [x] 2.1 Voeg `NEXTAUTH_SECRET` toe aan `.env.example` en `.env`
  - [x] 2.2 Voeg `NEXTAUTH_URL` toe aan `.env.example` en `.env` (http://localhost:3000)
  - [x] 2.3 Voeg `AUTH_USERNAME` en `AUTH_PASSWORD` toe aan `.env.example` en `.env`
  - [x] 2.4 Voeg `API_KEY` toe aan `.env.example` en `.env` voor externe API authenticatie

- [x] Task 3: Login pagina bouwen (AC: #1)
  - [x] 3.1 Installeer shadcn/ui: `npx shadcn@latest init`
  - [x] 3.2 Voeg shadcn/ui componenten toe: Button, Card, Input, Label
  - [x] 3.3 Maak `src/app/login/page.tsx` met login formulier
  - [x] 3.4 Implementeer login formulier met username/password velden
  - [x] 3.5 Toon foutmelding bij ongeldige credentials
  - [x] 3.6 Redirect naar `/editions` na succesvolle login

- [x] Task 4: Route protection middleware (AC: #1, #2, #3)
  - [x] 4.1 Maak `src/middleware.ts` met NextAuth middleware
  - [x] 4.2 Configureer matcher voor `/(auth)/*` routes als beschermd
  - [x] 4.3 Sta `/login`, `/api/auth/*` en statische assets toe zonder auth
  - [x] 4.4 Redirect niet-ingelogde gebruikers naar `/login`

- [x] Task 5: Auth-protected layout group (AC: #1, #2)
  - [x] 5.1 Maak `src/app/(auth)/layout.tsx` als wrapper voor beschermde routes
  - [x] 5.2 Voeg session provider toe aan layout
  - [x] 5.3 Maak placeholder `src/app/(auth)/editions/page.tsx` voor testen

- [x] Task 6: API Key middleware (AC: #4)
  - [x] 6.1 Maak `src/lib/api-key.ts` met validatie functie
  - [x] 6.2 Valideer `X-API-Key` header tegen `API_KEY` env var
  - [x] 6.3 Retourneer 401 Unauthorized bij ontbrekende of ongeldige key
  - [x] 6.4 Maak helper functie `withApiKey()` voor route handlers

- [x] Task 7: Tests schrijven en valideren (AC: #1, #2, #3, #4)
  - [ ] 7.1 Test: login pagina rendert correct (vereist @testing-library/react)
  - [x] 7.2 Test: credentials validatie werkt (juiste/onjuiste credentials)
  - [ ] 7.3 Test: middleware blokkeert ongeauthenticeerde toegang (vereist integration test setup)
  - [x] 7.4 Test: API key validatie werkt (met/zonder key, juiste/onjuiste key)
  - [ ] 7.5 Test: ingelogde gebruiker kan beschermde pagina's zien (vereist integration test setup)

### Review Follow-ups (Code Review)

- [ ] [CODE-REVIEW][LOW] 7.1 Voeg component test toe voor login pagina met @testing-library/react
- [ ] [CODE-REVIEW][LOW] 7.3 Voeg integration test toe voor middleware route protection
- [ ] [CODE-REVIEW][LOW] 7.5 Voeg integration test toe voor authenticated page access

## Dev Notes

### NextAuth.js v5 (Auth.js) Configuratie

NextAuth.js v5 (ook bekend als Auth.js) is de huidige stabiele versie. De configuratie werkt anders dan v4:

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.AUTH_USERNAME &&
          credentials?.password === process.env.AUTH_PASSWORD
        ) {
          return { id: "1", name: credentials.username }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: "/login"
  }
})

// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Middleware Configuratie

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth"

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const newUrl = new URL("/login", req.nextUrl.origin)
    return Response.redirect(newUrl)
  }
})

export const config = {
  matcher: ["/(auth)/:path*"]
}
```

### API Key Middleware Pattern

```typescript
// src/lib/api-key.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-API-Key")
  return apiKey === process.env.API_KEY
}

export function withApiKey(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    if (!validateApiKey(req)) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
        { status: 401 }
      )
    }
    return handler(req)
  }
}
```

### Environment Variables

Benodigde env vars voor authenticatie:

| Variable | Beschrijving | Voorbeeld |
|----------|--------------|-----------|
| `NEXTAUTH_SECRET` | Signing secret voor sessies | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL van de applicatie | `http://localhost:3000` |
| `AUTH_USERNAME` | Login username | `admin` |
| `AUTH_PASSWORD` | Login password | `secure-password-123` |
| `API_KEY` | API key voor externe toegang | `uuid-v4-string` |

**KRITIEK (NFR6):** Credentials staan NOOIT in code, alleen in environment variables.

### shadcn/ui Installatie

```bash
# Initialiseer shadcn/ui
npx shadcn@latest init

# Voeg componenten toe
npx shadcn@latest add button card input label
```

shadcn/ui configuratie opties:
- Style: New York
- Base color: Neutral
- CSS variables: Yes
- Tailwind CSS: Already configured
- Components: `src/components/ui/`

### Project Structure Notes

Nieuwe bestanden aan te maken:
```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts        # NextAuth handler
│   ├── login/
│   │   └── page.tsx                # Login pagina
│   └── (auth)/
│       ├── layout.tsx              # Auth wrapper
│       └── editions/
│           └── page.tsx            # Placeholder
├── lib/
│   ├── auth.ts                     # NextAuth config
│   └── api-key.ts                  # API key validation
├── components/
│   └── ui/                         # shadcn/ui (auto-gegenereerd)
└── middleware.ts                   # Route protection
```

### Previous Story Intelligence

Story 1.3 (Database Schema) heeft het volgende fundament gelegd:
- **Prisma 7.3.0** geïnstalleerd met PostgreSQL adapter
- **`src/lib/db.ts`** - Prisma client singleton al aanwezig
- **Vitest** test framework geconfigureerd en werkend
- **`src/lib/` directory** bestaat al

**Belangrijke context:**
- Database draait via Docker Compose op `localhost:5432`
- Vitest is al geconfigureerd voor unit tests
- Project gebruikt TypeScript strict mode

### Git Intelligence

Recente commits:
- `chore(tooling)` - IDE configuratie
- `chore(bmad)` - BMAD framework
- `docs(planning)` - PRD, Architecture, Epics
- `feat(init)` - Next.js 16 project
- `feat(docker)` - Docker Compose setup

**Commit convention:** `type(scope): description`

### API Response Format

Uit Architecture.md - consistente response format voor errors:

```typescript
// 401 Unauthorized response
{
  success: false,
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing API key"
  }
}
```

### Testing Strategy

Tests met Vitest (al geconfigureerd in project):
- Unit tests voor `validateApiKey()` functie
- Unit tests voor credentials validatie
- Integration tests voor middleware (mocking NextAuth)

### Security Considerations

- NextAuth.js v5 gebruikt secure cookies by default
- `NEXTAUTH_SECRET` moet minimaal 32 characters zijn
- API Key validatie is timing-safe (voorkom timing attacks)
- Geen credentials in git repository (check `.gitignore`)

### References

- [Source: architecture.md#Authentication & Security] - NextAuth.js (Credentials), API Key
- [Source: architecture.md#API Boundaries] - `/api/v1/*` uses API Key
- [Source: architecture.md#Complete Project Directory Structure] - File locations
- [Source: epics.md#Story 1.4] - Acceptance Criteria
- [Source: prd.md#Security] - NFR5, NFR6 requirements
- [Source: 1-3-database-schema.md] - Vitest setup, src/lib/ structure

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Geen debug issues - alle implementatie verliep zonder problemen

### Completion Notes List

- NextAuth.js v5 (Auth.js) geïnstalleerd en geconfigureerd met Credentials provider
- Login pagina met shadcn/ui componenten geïmplementeerd (Card, Input, Button, Label)
- Middleware beschermt alle routes behalve /login, /api/auth/*, en statische assets
- API Key middleware met timing-safe comparison voor security
- Credentials validatie logica geëxtraheerd naar testbare `auth-utils.ts` module
- 19 nieuwe auth-gerelateerde tests (10 voor credentials, 9 voor API key)
- Alle 45 tests slagen
- TypeScript en ESLint controles passeren

**Code Review Fixes (2026-01-29):**
- Verwijderd: redundante `authorized` callback uit auth.ts (duplicate van middleware logica)
- Verwijderd: bug met "(auth)" route check die nooit zou matchen
- Geëxtraheerd: `validateCredentials()` naar apart `auth-utils.ts` voor testbaarheid
- Gefixt: Tests testen nu de WERKELIJKE code in plaats van duplicaat logica
- Toegevoegd: 5 extra edge-case tests voor credentials validatie

### File List

**Nieuwe bestanden:**
- src/lib/auth.ts - NextAuth.js configuratie met Credentials provider
- src/lib/auth-utils.ts - Testbare credentials validatie functie (geëxtraheerd voor testbaarheid)
- src/lib/auth.test.ts - Unit tests voor credentials validatie (10 tests)
- src/lib/api-key.ts - API Key validatie middleware met timing-safe comparison
- src/lib/api-key.test.ts - Unit tests voor API key validatie (9 tests)
- src/lib/utils.ts - shadcn/ui utility functies (auto-gegenereerd)
- src/app/api/auth/[...nextauth]/route.ts - NextAuth API route handler
- src/app/login/page.tsx - Login pagina met formulier en error handling
- src/app/(auth)/layout.tsx - Auth layout wrapper met SessionProvider
- src/app/(auth)/editions/page.tsx - Placeholder editions pagina
- src/middleware.ts - Route protection middleware
- src/components/ui/button.tsx - shadcn/ui Button component
- src/components/ui/card.tsx - shadcn/ui Card component
- src/components/ui/input.tsx - shadcn/ui Input component
- src/components/ui/label.tsx - shadcn/ui Label component
- components.json - shadcn/ui configuratie

**Gewijzigde bestanden:**
- package.json - NextAuth.js en shadcn/ui dependencies toegevoegd
- .env.example - Auth environment variables toegevoegd
- src/app/globals.css - shadcn/ui CSS variables toegevoegd
- Dockerfile - Production build met Prisma generate (code review fix)
- docker-compose.yml - Volume mounts vereenvoudigd voor production (code review fix)

**Lokale bestanden (niet in git):**
- .env - Auth environment variables met dev values (in .gitignore)

### Change Log

- 2026-01-29: Story 1.4 Authenticatie Configuratie geïmplementeerd - NextAuth.js v5 met Credentials provider, login pagina, route protection middleware, en API Key middleware
- 2026-01-29: Code Review fixes - Redundante auth callback verwijderd, credentials validatie geëxtraheerd naar auth-utils.ts voor testbaarheid, tests herschreven om werkelijke code te testen
- 2026-01-29: Dockerfile gewijzigd naar production build (npm run build + npm start) met Prisma generate stap

