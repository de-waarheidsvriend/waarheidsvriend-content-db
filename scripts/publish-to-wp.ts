/**
 * WordPress Publication CLI Script
 *
 * Publishes all articles from an edition to WordPress.
 *
 * Usage:
 *   npx tsx scripts/publish-to-wp.ts --edition=123
 *   npx tsx scripts/publish-to-wp.ts --edition=123 --dry-run
 *
 * Or via npm script:
 *   npm run publish:wp -- --edition=123
 *   npm run publish:wp -- --edition=123 --dry-run
 */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

import {
  publishEditionToWordPress,
  validateCredentials,
  type PublishProgress,
} from "@/services/wordpress";

/**
 * Parse command line arguments
 */
function parseArgs(): { editionId: number | null; dryRun: boolean; help: boolean } {
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
WordPress Publication Script - De Waarheidsvriend

Publiceert alle artikelen van een editie naar WordPress.

Gebruik:
  npx tsx scripts/publish-to-wp.ts --edition=<id> [--dry-run]
  npm run publish:wp -- --edition=<id> [--dry-run]

Opties:
  --edition=<id>   Editie ID om te publiceren (verplicht)
  --dry-run        Simuleer publicatie zonder echte API calls
  --help, -h       Toon dit help bericht

Voorbeelden:
  npx tsx scripts/publish-to-wp.ts --edition=123
  npx tsx scripts/publish-to-wp.ts --edition=123 --dry-run

Environment Variables (in .env.local):
  NEXT_PUBLIC_WP_API_URL  WordPress REST API URL
  WP_USERNAME             WordPress gebruikersnaam
  WP_APP_PASSWORD         WordPress Application Password
`);
}

/**
 * Progress callback for console output
 */
function onProgress(progress: PublishProgress): void {
  const prefix = `[${progress.current}/${progress.total}]`;
  const title = progress.currentArticle.substring(0, 50);

  switch (progress.status) {
    case "syncing_author":
      process.stdout.write(`\r${prefix} Syncing author: ${title}...`.padEnd(80));
      break;
    case "uploading_image":
      process.stdout.write(`\r${prefix} Uploading image: ${title}...`.padEnd(80));
      break;
    case "publishing":
      process.stdout.write(`\r${prefix} Publishing: ${title}...`.padEnd(80));
      break;
    case "completed":
      console.log(`\r${prefix} ✓ Published: ${title}`.padEnd(80));
      break;
    case "failed":
      console.log(`\r${prefix} ✗ Failed: ${title}`.padEnd(80));
      break;
  }
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

  console.log("═".repeat(60));
  console.log("WordPress Publicatie - De Waarheidsvriend");
  console.log("═".repeat(60));
  console.log();

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - Geen echte API calls worden gemaakt\n");
  }

  // Validate credentials first
  console.log("Controleren WordPress credentials...");
  const validation = await validateCredentials();

  if (!validation.valid) {
    console.error(`\n❌ ${validation.error}`);
    console.error("\nControleer de volgende environment variables:");
    console.error("  - NEXT_PUBLIC_WP_API_URL");
    console.error("  - WP_USERNAME");
    console.error("  - WP_APP_PASSWORD");
    process.exit(1);
  }

  console.log(`✓ Ingelogd als: ${validation.username}\n`);

  // Publish
  console.log(`Publiceren editie ${editionId}...\n`);

  const result = await publishEditionToWordPress(editionId, {
    dryRun,
    onProgress,
  });

  // Summary
  console.log("\n" + "─".repeat(60));
  console.log("Samenvatting:");
  console.log("─".repeat(60));
  console.log(`Editie:            ${editionId}`);
  console.log(`Gepubliceerd:      ${result.articlesPublished}`);
  console.log(`Mislukt:           ${result.articlesFailed}`);
  console.log(`Overgeslagen:      ${result.articlesSkipped}`);

  if (result.errors.length > 0) {
    console.log("\nFouten:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  // Print results table
  if (result.results.length > 0) {
    console.log("\nDetails:");
    console.log("─".repeat(60));

    for (const r of result.results) {
      const status = r.success ? "✓" : "✗";
      const title = r.title.substring(0, 40).padEnd(40);
      const action = r.created ? "nieuw" : "update";
      const info = r.wpPostId ? `ID: ${r.wpPostId} (${action})` : r.error || "";
      console.log(`${status} ${title} ${info}`);
    }
  }

  console.log("\n" + "═".repeat(60));

  if (result.success) {
    console.log("✓ Publicatie succesvol afgerond");
    process.exit(0);
  } else {
    console.log("✗ Publicatie afgerond met fouten");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nOnverwachte fout:", error);
  process.exit(1);
});
