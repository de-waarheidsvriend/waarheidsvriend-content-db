# Story 1.5: Basis UI Layout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Als Joost,
Wil ik een consistente UI layout hebben,
Zodat ik makkelijk kan navigeren door het systeem.

## Acceptance Criteria

1. **Given** shadcn/ui is geïnstalleerd
   **When** ik de applicatie open
   **Then** zie ik een header met:
   - Applicatienaam ("Waarheidsvriend Content DB")
   - Navigatie naar Edities
   - Logout knop

2. **And** is er een `src/components/ui/` folder met shadcn/ui componenten
   **And** zijn minimaal de volgende componenten beschikbaar: Button, Card, Input, Skeleton

3. **And** is er een `src/components/shared/Header.tsx` component

4. **And** is er een root layout die de header bevat

5. **And** is er een placeholder homepage die doorverwijst naar `/editions`

## Tasks / Subtasks

- [x] Task 1: shadcn/ui componenten toevoegen (AC: #2)
  - [x] 1.1 Voeg Button component toe: `npx shadcn@latest add button`
  - [x] 1.2 Voeg Card component toe: `npx shadcn@latest add card`
  - [x] 1.3 Voeg Input component toe: `npx shadcn@latest add input`
  - [x] 1.4 Voeg Skeleton component toe: `npx shadcn@latest add skeleton`
  - [x] 1.5 Verifieer dat alle componenten in `src/components/ui/` staan

- [x] Task 2: Header component bouwen (AC: #1, #3)
  - [x] 2.1 Maak `src/components/shared/` directory
  - [x] 2.2 Maak `src/components/shared/Header.tsx` met:
    - Applicatienaam "Waarheidsvriend Content DB" (links)
    - Navigatie link naar `/editions` (midden)
    - Logout knop (rechts) die `signOut()` aanroept
  - [x] 2.3 Gebruik Button component van shadcn/ui voor Logout knop
  - [x] 2.4 Gebruik Link component van next/link voor navigatie
  - [x] 2.5 Style header met Tailwind: sticky top, border-bottom, achtergrondkleur

- [x] Task 3: Root layout aanpassen (AC: #4)
  - [x] 3.1 Update `src/app/layout.tsx` metadata (title, description)
  - [x] 3.2 Importeer en render Header component in root layout
  - [x] 3.3 Wrap children in main element met padding
  - [x] 3.4 Zorg dat header alleen getoond wordt voor ingelogde gebruikers

- [x] Task 4: Homepage redirect implementeren (AC: #5)
  - [x] 4.1 Vervang inhoud van `src/app/page.tsx`
  - [x] 4.2 Implementeer server-side redirect naar `/editions`
  - [x] 4.3 Gebruik `redirect()` van `next/navigation`

- [x] Task 5: Auth layout met header (AC: #1, #4)
  - [x] 5.1 Maak `src/app/(auth)/layout.tsx` indien niet bestaat
  - [x] 5.2 Integreer SessionProvider van next-auth
  - [x] 5.3 Zorg dat Header toegang heeft tot sessie voor logout functionaliteit

- [x] Task 6: Editions placeholder pagina (AC: #5)
  - [x] 6.1 Maak `src/app/(auth)/editions/page.tsx`
  - [x] 6.2 Toon placeholder content: "Edities - Coming soon"
  - [x] 6.3 Gebruik Card component om content te wrappen

## Dev Notes

### shadcn/ui Componenten Toevoegen

shadcn/ui is al geïnitialiseerd in dit project (components.json bestaat). Om componenten toe te voegen:

```bash
# Voeg alle benodigde componenten toe
npx shadcn@latest add button card input skeleton
```

shadcn/ui configuratie (uit components.json):
- Style: new-york
- Base color: neutral
- Icon library: lucide
- Components path: `@/components/ui`

### Header Component Pattern

```typescript
// src/components/shared/Header.tsx
"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Waarheidsvriend Content DB</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/editions" className="transition-colors hover:text-foreground/80">
              Edities
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" onClick={() => signOut()}>
            Uitloggen
          </Button>
        </div>
      </div>
    </header>
  )
}
```

### Root Layout Update

```typescript
// src/app/layout.tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Waarheidsvriend Content DB",
  description: "Content extractie en publicatie platform voor De Waarheidsvriend",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

### Auth Layout Pattern

```typescript
// src/app/(auth)/layout.tsx
import { SessionProvider } from "next-auth/react"
import { Header } from "@/components/shared/Header"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <Header />
      <main className="container mx-auto py-6">
        {children}
      </main>
    </SessionProvider>
  )
}
```

### Homepage Redirect

```typescript
// src/app/page.tsx
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/editions")
}
```

### Editions Placeholder

```typescript
// src/app/(auth)/editions/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function EditionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Edities</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            De editie-overzicht functionaliteit wordt geïmplementeerd in Epic 2.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Project Structure Notes

Na voltooiing van deze story:

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx              # Updated met metadata
│   ├── page.tsx                # Redirect naar /editions
│   ├── login/
│   │   └── page.tsx            # (uit story 1-4)
│   └── (auth)/
│       ├── layout.tsx          # Auth wrapper met Header
│       └── editions/
│           └── page.tsx        # Placeholder
├── components/
│   ├── ui/                     # shadcn/ui componenten
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── skeleton.tsx
│   └── shared/
│       └── Header.tsx          # Header component
└── lib/
    ├── auth.ts                 # (bestaand)
    ├── db.ts                   # (bestaand)
    └── utils.ts                # (bestaand - cn() functie)
```

### Previous Story Intelligence

**Story 1-4 (Authenticatie Configuratie) heeft voorbereid:**
- NextAuth.js v5 geconfigureerd in `src/lib/auth.ts`
- Route handler in `src/app/api/auth/[...nextauth]/route.ts`
- `signIn` en `signOut` functies geëxporteerd uit auth.ts
- Login pagina verwijst naar `/login`
- Auth callback redirects naar `/editions`

**BELANGRIJK:** Story 1-4 is nog "ready-for-dev" maar de auth basis is al aanwezig. Deze story (1-5) kan parallel ontwikkeld worden. De login pagina (`/login`) wordt in story 1-4 gebouwd.

**Reeds aanwezig:**
- `src/lib/utils.ts` met `cn()` functie voor shadcn/ui
- `components.json` shadcn/ui configuratie
- Vitest test framework geconfigureerd
- TypeScript strict mode

### Git Intelligence

Recente commits:
- `feat(database): add Prisma schema` - Story 1.3 afgerond
- `chore(tooling)` - IDE configuratie
- `docs(planning)` - Planning documenten
- `feat(init)` - Next.js 16 project

**Commit convention:** `type(scope): description`

Suggestie voor deze story:
```
feat(ui): add base layout with Header component (Story 1.5)
```

### Tailwind CSS v4 Notities

Dit project gebruikt Tailwind CSS v4. Belangrijke verschillen:
- Geen `tailwind.config.ts` nodig (CSS-first configuratie)
- CSS variables standaard in `globals.css`
- Container class werkt anders (geen padding by default)

### Dependencies Overzicht

shadcn/ui dependencies (al geïnstalleerd via shadcn init):
- `clsx` - Conditional class names
- `tailwind-merge` - Merge Tailwind classes
- `lucide-react` - Icon library (optioneel voor icons)

Nieuw toe te voegen (indien niet aanwezig):
```bash
npm install lucide-react
```

### Testing Considerations

- Unit tests voor Header component (render tests)
- Integration test: redirect van homepage naar /editions
- Vitest is al geconfigureerd in project

### Security Considerations

- Header toont geen gevoelige informatie
- Logout knop gebruikt NextAuth `signOut()` voor veilige sessie-beëindiging
- Auth layout beschermt routes via middleware (uit story 1-4)

### References

- [Source: architecture.md#Frontend Architecture] - shadcn/ui, React Query
- [Source: architecture.md#Complete Project Directory Structure] - File locations
- [Source: architecture.md#Naming Patterns] - Component naming conventions
- [Source: epics.md#Story 1.5] - Acceptance Criteria
- [Source: prd.md#Technical Requirements] - SPA architecture
- [Source: 1-4-authenticatie-configuratie.md] - Auth setup, shadcn init

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- N/A

### Completion Notes List

- Task 1: shadcn/ui componenten waren deels al aanwezig (button, card, input, label). Skeleton toegevoegd via `npx shadcn@latest add skeleton`.
- Task 2: Header component gemaakt met applicatienaam, navigatie naar /editions, en logout knop met signOut() van next-auth/react.
- Task 3: Root layout metadata geüpdatet naar Nederlandse taal en project-specifieke title/description. Header wordt gerenderd in (auth) layout om alleen voor ingelogde gebruikers te tonen.
- Task 4: Homepage redirect geïmplementeerd met `redirect("/editions")` van next/navigation.
- Task 5: Auth layout al aanwezig uit story 1-4, Header component toegevoegd met SessionProvider integratie.
- Task 6: Editions placeholder pagina geüpdatet om Card component van shadcn/ui te gebruiken.
- Tests toegevoegd: Header.test.ts en components.test.ts voor component import validatie.
- Alle 45 tests slagen, build succesvol, geen lint errors.

### File List

**New files:**
- src/components/ui/skeleton.tsx
- src/components/shared/Header.tsx
- src/components/shared/Header.test.tsx (render tests met @testing-library/react)
- src/components/ui/components.test.ts
- src/app/page.test.ts (homepage redirect test)
- src/app/(auth)/layout.test.ts (auth layout test)
- src/app/(auth)/editions/page.test.tsx (editions placeholder test)
- src/test/setup.ts (vitest setup voor jest-dom matchers)

**Modified files:**
- src/app/layout.tsx (metadata en lang="nl")
- src/app/page.tsx (redirect naar /editions)
- src/app/(auth)/layout.tsx (Header component toegevoegd)
- src/app/(auth)/editions/page.tsx (Card component gebruikt)
- src/lib/auth.test.ts (import fix: auth → auth-utils)
- vitest.config.ts (React plugin, tsx tests, setup files)
- package.json (testing-library dependencies)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-29 | Story implementation completed - all tasks done | Claude Opus 4.5 |
| 2026-01-29 | Code review fixes: Added proper render tests for Header, homepage redirect test, auth layout test, editions page test. Installed @testing-library/react, @testing-library/dom, @testing-library/jest-dom, jsdom, @vitejs/plugin-react. Updated vitest.config.ts. | Claude Opus 4.5 (Code Review) |
