# BMAD Development Workflow

Dit document beschrijft de BMAD development workflow voor dit project.

## BMAD Commando's

| Afkorting | Commando | Beschrijving |
|-----------|----------|--------------|
| **CS** | `bmad-bmm-create-story` | Story file aanmaken vanuit epic |
| **VS** | `bmad-bmm-create-story` (validate) | Story valideren op volledigheid |
| **DS** | `bmad-bmm-dev-story` | Story implementeren |
| **CR** | `bmad-bmm-code-review` | Adversarial code review |
| **ER** | `bmad-bmm-retrospective` | Epic retrospective na afronding |

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BMAD Story Workflow                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────┐         ┌────────┐         ┌────────┐         ┌────────┐
    │   CS   │         │   DS   │         │   CR   │         │  Next  │
    │ Create │──────▶  │  Dev   │──────▶  │ Review │──────▶  │ Story  │
    │ Story  │         │ Story  │         │        │         │        │
    └────────┘         └────────┘         └────────┘         └────────┘
         │                  │                  │
         ▼                  ▼                  ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ COMMIT  │        │ COMMIT  │        │ COMMIT  │
    │         │        │         │        │ (fixes) │
    └─────────┘        └─────────┘        └─────────┘

                    ▼ Bij issues ▼
              ┌──────────────────────┐
              │  Fix → Test → Commit │
              │         ↓            │
              │   Terug naar CR      │
              └──────────────────────┘
```

## Stap-voor-Stap Instructies

### Fase 1: Story Aanmaken (CS)

Start een nieuwe story vanuit de epic definitie.

```
/bmad-bmm-create-story
```

**Wat gebeurt er:**
1. BMAD analyseert de epics en selecteert de volgende story
2. Story file wordt gegenereerd met taken en acceptatiecriteria
3. Story krijgt status `ready-for-dev`

**Na afronding:**
```bash
git add _bmad-output/implementation-artifacts/
git commit -m "docs: add Story X-Y story file (ready-for-dev)"
```

### Fase 2: Story Implementeren (DS)

Implementeer de story volgens de gedefinieerde taken.

```
/bmad-bmm-dev-story
```

**Wat gebeurt er:**
1. BMAD leest de story file en begint met implementatie
2. Taken worden een voor een uitgevoerd
3. Tests worden geschreven en uitgevoerd
4. Story status wordt bijgewerkt

**Belangrijke checks voor commit:**
- [ ] Alle tests slagen (`npm test`)
- [ ] Linting is OK (`npm run lint`)
- [ ] Build slaagt (`npm run build`)

**Na afronding:**
```bash
git add .
git commit -m "feat(scope): korte beschrijving (Story X.Y)"
```

### Fase 3: Code Review (CR)

Voer een adversarial code review uit met verse context.

**BELANGRIJK:** Start een nieuwe Claude sessie voor objectieve review!

```
/bmad-bmm-code-review
```

**Wat gebeurt er:**
1. BMAD reviewt alle code wijzigingen kritisch
2. Minimum 3-10 issues worden geidentificeerd
3. Findings worden gerapporteerd met fix suggesties

**Bij gevonden issues:**
1. Fix de problemen
2. Run tests opnieuw
3. Commit de fixes:

```bash
git add .
git commit -m "fix(review): resolve Story X-Y code review issues"
```

4. Herhaal CR indien nodig

### Fase 4: Epic Retrospective (ER)

Na afronding van alle stories in een epic.

```
/bmad-bmm-retrospective
```

**Wat gebeurt er:**
1. Review van de gehele epic
2. Lessons learned worden gedocumenteerd
3. Impact op volgende epic wordt geanalyseerd

## Belangrijke Regels

### Altijd Committen Na Elke Fase

| Fase | Commit Message Format |
|------|----------------------|
| CS | `docs: add Story X-Y story file (ready-for-dev)` |
| DS | `feat(scope): beschrijving (Story X.Y)` |
| CR fixes | `fix(review): resolve Story X-Y code review issues` |

### Verse Context Voor Reviews

Start **altijd** een nieuwe Claude sessie voor code reviews. Dit zorgt voor:
- Objectieve beoordeling zonder bias
- Geen aannames uit implementatie context
- Betere detectie van issues

### Tests Moeten Slagen

Commit nooit code met falende tests:

```bash
# Check alles voor commit
npm test
npm run lint
npm run build
```

### Sprint Status Bijwerken

Update `sprint-status.yaml` bij status wijzigingen:
- `ready-for-dev` → `in-progress` → `review` → `done`

## Bestandslocaties

| Bestand | Locatie |
|---------|---------|
| Epic definities | `_bmad-output/planning-artifacts/epics.md` |
| Story files | `_bmad-output/implementation-artifacts/story-X-Y-*.md` |
| Sprint status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Architectuur | `_bmad-output/planning-artifacts/architecture.md` |
| PRD | `_bmad-output/planning-artifacts/prd.md` |

## Snelle Referentie

```bash
# Nieuwe story starten
/bmad-bmm-create-story
git add . && git commit -m "docs: add Story X-Y story file (ready-for-dev)"

# Story implementeren
/bmad-bmm-dev-story
npm test && git add . && git commit -m "feat(scope): beschrijving (Story X.Y)"

# Code review (NIEUWE SESSIE!)
/bmad-bmm-code-review
# Fix issues indien nodig
git add . && git commit -m "fix(review): resolve Story X-Y code review issues"

# Epic afronden
/bmad-bmm-retrospective
```
