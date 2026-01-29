/**
 * Manual test script for XHTML Loader
 *
 * Usage: npx tsx scripts/test-xhtml-loader.ts <path-to-xhtml-export>
 *
 * Example: npx tsx scripts/test-xhtml-loader.ts ./uploads/editions/1/xhtml
 */

import { loadXhtmlExport } from "../src/services/parser/xhtml-loader";

async function main() {
  const xhtmlDir = process.argv[2];

  if (!xhtmlDir) {
    console.log("Usage: npx tsx scripts/test-xhtml-loader.ts <path-to-xhtml-export>");
    console.log("");
    console.log("Example paths:");
    console.log("  ./uploads/editions/1/xhtml");
    console.log("  /absolute/path/to/xhtml-export");
    process.exit(1);
  }

  console.log(`\n📂 Loading XHTML export from: ${xhtmlDir}\n`);

  try {
    const result = await loadXhtmlExport(xhtmlDir);

    console.log("═".repeat(60));
    console.log("📊 RESULTS");
    console.log("═".repeat(60));

    // Spreads
    console.log(`\n📄 Spreads loaded: ${result.spreads.length}`);
    for (const spread of result.spreads) {
      console.log(`   - ${spread.filename} → spread ${spread.spreadIndex}, pages ${spread.pageStart}-${spread.pageEnd}`);
    }

    // Images
    console.log(`\n🖼️  Images indexed: ${result.images.images.size}`);
    console.log(`   - Article images: ${result.images.articleImages.length}`);
    console.log(`   - Author photos: ${result.images.authorPhotos.length}`);
    console.log(`   - Decorative: ${result.images.decorativeImages.length}`);

    // Styles
    console.log(`\n🎨 CSS classes found: ${result.styles.classMap.size}`);
    if (result.styles.titleClasses.length > 0) {
      console.log(`   - Title classes: ${result.styles.titleClasses.join(", ")}`);
    }
    if (result.styles.chapeauClasses.length > 0) {
      console.log(`   - Chapeau classes: ${result.styles.chapeauClasses.join(", ")}`);
    }
    if (result.styles.bodyClasses.length > 0) {
      console.log(`   - Body classes: ${result.styles.bodyClasses.join(", ")}`);
    }
    if (result.styles.authorClasses.length > 0) {
      console.log(`   - Author classes: ${result.styles.authorClasses.join(", ")}`);
    }

    // Metadata
    console.log(`\n📰 Metadata:`);
    console.log(`   - Edition number: ${result.metadata.editionNumber ?? "not found"}`);
    console.log(`   - Edition date: ${result.metadata.editionDate?.toLocaleDateString("nl-NL") ?? "not found"}`);

    // Errors
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log("✅ Test complete!");

  } catch (error) {
    console.error("❌ Failed to load XHTML export:", error);
    process.exit(1);
  }
}

main();
