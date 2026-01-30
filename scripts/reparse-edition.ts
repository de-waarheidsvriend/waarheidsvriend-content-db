/**
 * Re-parse Edition CLI Script
 *
 * Re-parses an existing edition using the same pipeline as the upload route.
 * Useful for reprocessing articles after parser fixes.
 *
 * Usage:
 *   npx tsx scripts/reparse-edition.ts --edition=423
 *   npx tsx scripts/reparse-edition.ts --edition=423 --dry-run
 *
 * Or via npm script:
 *   npm run reparse -- --edition=423
 *   npm run reparse -- --edition=423 --dry-run
 */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// Load environment variables BEFORE any other imports
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

import type { PrismaClient } from "@prisma/client";
import type { ProcessingResult } from "@/services/parser";

/**
 * Parse command line arguments
 */
function parseArgs(): {
  editionId: number | null;
  dryRun: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  let editionId: number | null = null;
  let dryRun = false;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--edition=")) {
      const value = arg.substring("--edition=".length);
      editionId = parseInt(value, 10);
      if (isNaN(editionId)) {
        editionId = null;
      }
    }
  }

  return { editionId, dryRun, help };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Re-parse Edition Script - De Waarheidsvriend

Verwerkt een bestaande editie opnieuw met de huidige parser.
Nuttig na parser fixes om artikelen te herverwerken.

Gebruik:
  npx tsx scripts/reparse-edition.ts --edition=<id> [--dry-run]
  npm run reparse -- --edition=<id> [--dry-run]

Opties:
  --edition=<id>   Editie ID om opnieuw te verwerken (verplicht)
  --dry-run        Toon wat er zou gebeuren zonder wijzigingen
  --help, -h       Toon dit help bericht

Voorbeelden:
  npx tsx scripts/reparse-edition.ts --edition=423
  npx tsx scripts/reparse-edition.ts --edition=423 --dry-run

Let op:
  - Bestaande artikelen, auteur-koppelingen en afbeeldingen worden verwijderd
  - Page images (PDF conversies) blijven behouden
  - De editie zelf blijft bestaan
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { editionId, dryRun, help } = parseArgs();

  if (help) {
    printUsage();
    process.exit(0);
  }

  if (editionId === null) {
    console.error("Fout: --edition=<id> is verplicht\n");
    printUsage();
    process.exit(1);
  }

  // Dynamic imports after env is loaded
  const { prisma } = (await import("@/lib/db")) as { prisma: PrismaClient };
  const { processEdition } = (await import("@/services/parser")) as {
    processEdition: (
      editionId: number,
      editionDir: string,
      uploadsDir: string
    ) => Promise<ProcessingResult>;
  };

  console.log("═".repeat(60));
  console.log("Re-parse Editie - De Waarheidsvriend");
  console.log("═".repeat(60));
  console.log();

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - Geen wijzigingen worden gemaakt\n");
  }

  // Step 1: Validate edition exists
  console.log(`Zoeken naar editie ${editionId}...`);

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      _count: {
        select: {
          articles: true,
          page_images: true,
        },
      },
    },
  });

  if (!edition) {
    console.error(`\n❌ Editie ${editionId} niet gevonden in database`);
    process.exit(1);
  }

  // Get image count separately (images are linked to articles, not directly to edition)
  const imageCount = await prisma.image.count({
    where: {
      article: {
        edition_id: editionId,
      },
    },
  });

  // Get author links count
  const authorLinksCount = await prisma.articleAuthor.count({
    where: {
      article: {
        edition_id: editionId,
      },
    },
  });

  console.log(`✓ Editie gevonden: Nr. ${edition.edition_number}`);
  console.log(`  Status:           ${edition.status}`);
  console.log(`  Artikelen:        ${edition._count.articles}`);
  console.log(`  Afbeeldingen:     ${imageCount}`);
  console.log(`  Auteur links:     ${authorLinksCount}`);
  console.log(`  Page images:      ${edition._count.page_images} (worden behouden)`);
  console.log();

  // Validate edition directory exists
  const uploadsDir = join(projectRoot, "uploads");
  const editionDir = join(uploadsDir, "editions", String(editionId));
  const xhtmlDir = join(editionDir, "xhtml");

  if (!existsSync(editionDir)) {
    console.error(`\n❌ Editie directory niet gevonden: ${editionDir}`);
    process.exit(1);
  }

  if (!existsSync(xhtmlDir)) {
    console.error(`\n❌ XHTML directory niet gevonden: ${xhtmlDir}`);
    process.exit(1);
  }

  console.log(`✓ Editie directory: ${editionDir}`);
  console.log();

  if (dryRun) {
    console.log("─".repeat(60));
    console.log("DRY RUN - Wat er zou gebeuren:");
    console.log("─".repeat(60));
    console.log(`  1. Verwijderen: ${authorLinksCount} auteur-artikel koppelingen`);
    console.log(`  2. Verwijderen: ${imageCount} afbeeldingen`);
    console.log(`  3. Verwijderen: ${edition._count.articles} artikelen`);
    console.log(`  4. Behouden:    ${edition._count.page_images} page images`);
    console.log(`  5. Opnieuw verwerken via processEdition()`);
    console.log();
    console.log("Geen wijzigingen gemaakt (dry-run mode)");
    process.exit(0);
  }

  // Step 2: Delete existing related data
  console.log("Verwijderen bestaande data...");

  // Delete articles (cascades to article_authors and images automatically)
  const deleteResult = await prisma.article.deleteMany({
    where: { edition_id: editionId },
  });

  console.log(`✓ ${deleteResult.count} artikelen verwijderd (incl. afbeeldingen en auteur-links)`);
  console.log();

  // Reset edition status to pending
  await prisma.edition.update({
    where: { id: editionId },
    data: { status: "pending" },
  });

  // Step 3: Re-process edition
  console.log("Opnieuw verwerken editie...");
  console.log("─".repeat(60));

  const startTime = Date.now();
  const result = await processEdition(editionId, editionDir, uploadsDir);
  const elapsedMs = Date.now() - startTime;

  // Step 4: Show results
  console.log();
  console.log("─".repeat(60));
  console.log("Resultaat:");
  console.log("─".repeat(60));
  console.log(`Status:            ${result.status}`);
  console.log(`Artikelen:         ${result.stats.articlesSaved} (van ${result.stats.articlesExtracted} geëxtraheerd)`);
  console.log(`Auteurs:           ${result.stats.authorsSaved} (van ${result.stats.authorsExtracted} geëxtraheerd)`);
  console.log(`Afbeeldingen:      ${result.stats.imagesSaved} (van ${result.stats.imagesExtracted} geëxtraheerd)`);
  console.log(`PDF pagina's:      ${result.stats.pdfPagesConverted}`);
  console.log(`Tijd:              ${(elapsedMs / 1000).toFixed(2)}s`);

  if (result.warnings.length > 0) {
    console.log();
    console.log(`Waarschuwingen: ${result.warnings.length}`);
    for (const warning of result.warnings.slice(0, 10)) {
      console.log(`  ⚠️  [${warning.module}] ${warning.message}`);
    }
    if (result.warnings.length > 10) {
      console.log(`  ... en ${result.warnings.length - 10} meer`);
    }
  }

  if (result.errors.length > 0) {
    console.log();
    console.log(`Fouten: ${result.errors.length}`);
    for (const error of result.errors) {
      console.log(`  ❌ [${error.module}] ${error.message}`);
    }
  }

  console.log();
  console.log("═".repeat(60));

  if (result.success) {
    console.log("✓ Re-parse succesvol afgerond");
    process.exit(0);
  } else {
    console.log("✗ Re-parse afgerond met fouten");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nOnverwachte fout:", error);
  process.exit(1);
});
