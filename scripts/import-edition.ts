/**
 * Import a new edition from XHTML zip and PDF
 * Usage: npx tsx scripts/import-edition.ts --xhtml=path/to/file.zip --pdf=path/to/file.pdf --number=5
 */
import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdir, cp, rm } from "fs/promises";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

import { prisma } from "@/lib/db";
import { processEdition } from "@/services/parser";

function parseArgs(): { xhtml: string; pdf: string; number: number } {
  const args = process.argv.slice(2);
  let xhtml = "";
  let pdf = "";
  let number = 0;

  for (const arg of args) {
    if (arg.startsWith("--xhtml=")) {
      xhtml = arg.slice(8);
    } else if (arg.startsWith("--pdf=")) {
      pdf = arg.slice(6);
    } else if (arg.startsWith("--number=")) {
      number = parseInt(arg.slice(9), 10);
    }
  }

  if (!xhtml || !pdf || !number) {
    console.error("Usage: npx tsx scripts/import-edition.ts --xhtml=path/to/file.zip --pdf=path/to/file.pdf --number=5");
    process.exit(1);
  }

  return { xhtml, pdf, number };
}

async function main() {
  const { xhtml, pdf, number } = parseArgs();

  console.log("════════════════════════════════════════════════════════════");
  console.log("Import Editie - De Waarheidsvriend");
  console.log("════════════════════════════════════════════════════════════\n");

  console.log(`XHTML zip: ${xhtml}`);
  console.log(`PDF: ${pdf}`);
  console.log(`Editie nummer: ${number}\n`);

  // Create edition in database
  console.log("Aanmaken editie in database...");
  const edition = await prisma.edition.create({
    data: {
      edition_number: number,
      edition_date: new Date(),
      status: "processing",
    },
  });
  console.log(`✓ Editie aangemaakt met ID: ${edition.id}\n`);

  // Set up directories
  const uploadsDir = join(projectRoot, "uploads");
  const editionDir = join(uploadsDir, `edition-${edition.id}`);
  const xhtmlDir = join(editionDir, "xhtml");
  const pdfDir = join(editionDir, "pdf");

  try {
    // Create directories
    await mkdir(xhtmlDir, { recursive: true });
    await mkdir(pdfDir, { recursive: true });

    // Extract XHTML zip
    console.log("Uitpakken XHTML zip...");
    const zip = new AdmZip(xhtml);
    zip.extractAllTo(xhtmlDir, true);

    // Find the actual content directory (might be nested)
    const { readdirSync, statSync } = await import("fs");
    const entries = readdirSync(xhtmlDir);
    const subDir = entries.find(e =>
      !e.startsWith("__MACOSX") &&
      !e.startsWith(".") &&
      statSync(join(xhtmlDir, e)).isDirectory()
    );

    if (subDir) {
      // Move contents up one level
      const nestedDir = join(xhtmlDir, subDir);
      const nestedEntries = readdirSync(nestedDir);
      for (const entry of nestedEntries) {
        await cp(join(nestedDir, entry), join(xhtmlDir, entry), { recursive: true });
      }
      await rm(nestedDir, { recursive: true });
    }

    // Remove __MACOSX if present
    const macosxDir = join(xhtmlDir, "__MACOSX");
    try {
      await rm(macosxDir, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }

    console.log(`✓ XHTML uitgepakt naar: ${xhtmlDir}\n`);

    // Copy PDF
    console.log("Kopiëren PDF...");
    const pdfDest = join(pdfDir, "editie.pdf");
    await cp(pdf, pdfDest);
    console.log(`✓ PDF gekopieerd naar: ${pdfDest}\n`);

    // Process edition
    console.log("Verwerken editie...");
    console.log("────────────────────────────────────────────────────────────\n");

    const result = await processEdition(edition.id, editionDir, uploadsDir);

    console.log("\n────────────────────────────────────────────────────────────");
    console.log("Samenvatting:");
    console.log("────────────────────────────────────────────────────────────");
    console.log(`Status:              ${result.status}`);
    console.log(`Artikelen:           ${result.stats.articlesSaved}`);
    console.log(`Auteurs:             ${result.stats.authorsSaved}`);
    console.log(`Afbeeldingen:        ${result.stats.imagesSaved}`);
    console.log(`PDF pagina's:        ${result.stats.pdfPagesConverted}`);
    console.log(`Verwerkingstijd:     ${result.stats.elapsedMs}ms`);

    if (result.errors.length > 0) {
      console.log("\nFouten:");
      for (const err of result.errors) {
        console.log(`  - ${err.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log("\nWaarschuwingen:");
      for (const warn of result.warnings.slice(0, 10)) {
        console.log(`  - ${warn.message}`);
      }
      if (result.warnings.length > 10) {
        console.log(`  ... en ${result.warnings.length - 10} meer`);
      }
    }

    console.log("\n✓ Import voltooid!\n");
    console.log(`Editie ID: ${edition.id}`);
    console.log(`Test met: npm run publish:wp -- --edition=${edition.id} --dry-run`);

  } catch (error) {
    console.error("\n❌ Fout tijdens import:", error);

    // Update edition status to failed
    await prisma.edition.update({
      where: { id: edition.id },
      data: { status: "failed" },
    });

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
