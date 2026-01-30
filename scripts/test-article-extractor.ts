/**
 * Manual test script for Article Extractor
 *
 * Usage: npx tsx scripts/test-article-extractor.ts <path-to-xhtml-export>
 *
 * Example: npx tsx scripts/test-article-extractor.ts ./uploads/editions/1/xhtml
 */

import { loadXhtmlExport } from "../src/services/parser/xhtml-loader";
import { extractArticles } from "../src/services/parser/article-extractor";

async function main() {
  const xhtmlDir = process.argv[2];

  if (!xhtmlDir) {
    console.log("Usage: npx tsx scripts/test-article-extractor.ts <path-to-xhtml-export>");
    console.log("");
    console.log("Example paths:");
    console.log("  ./uploads/editions/1/xhtml");
    console.log("  /absolute/path/to/xhtml-export");
    process.exit(1);
  }

  console.log(`\n📂 Loading XHTML export from: ${xhtmlDir}\n`);

  try {
    // Step 1: Load XHTML export
    console.log("Step 1: Loading XHTML export...");
    const xhtmlExport = await loadXhtmlExport(xhtmlDir);

    if (xhtmlExport.errors.length > 0) {
      console.log(`⚠️  XHTML Loader warnings: ${xhtmlExport.errors.length}`);
      for (const error of xhtmlExport.errors) {
        console.log(`   - ${error}`);
      }
    }

    console.log(`✓ Loaded ${xhtmlExport.spreads.length} spreads`);
    console.log(`✓ Found ${xhtmlExport.styles.titleClasses.length} title classes: ${xhtmlExport.styles.titleClasses.join(", ") || "none"}`);
    console.log(`✓ Found ${xhtmlExport.styles.bodyClasses.length} body classes: ${xhtmlExport.styles.bodyClasses.join(", ") || "none"}`);

    // Step 2: Extract articles
    console.log("\nStep 2: Extracting articles...");
    const result = await extractArticles(xhtmlExport);

    console.log("═".repeat(70));
    console.log("📰 EXTRACTED ARTICLES");
    console.log("═".repeat(70));

    if (result.articles.length === 0) {
      console.log("\n⚠️  No articles found!");
      console.log("   This could mean:");
      console.log("   - The XHTML export has no recognized title classes");
      console.log("   - The HTML structure is different from expected");
      console.log("   - The spreads are empty (e.g., only images)");
    }

    for (let i = 0; i < result.articles.length; i++) {
      const article = result.articles[i];
      console.log(`\n${"─".repeat(70)}`);
      console.log(`📄 Article ${i + 1}: ${article.title}`);
      console.log(`${"─".repeat(70)}`);

      if (article.category) {
        console.log(`   📁 Category: ${article.category}`);
      }

      if (article.chapeau) {
        console.log(`   📝 Chapeau: ${truncate(article.chapeau, 100)}`);
      }

      console.log(`   📖 Pages: ${article.pageStart}${article.pageEnd !== article.pageStart ? `-${article.pageEnd}` : ""}`);
      console.log(`   📑 Spreads: ${article.sourceSpreadIndexes.join(", ")}`);

      // Show content stats
      const contentLength = article.content.length;
      const wordCount = article.content.split(/\s+/).filter(Boolean).length;
      console.log(`   📊 Content: ${contentLength} chars, ~${wordCount} words`);

      // Show first bit of content
      if (article.content) {
        const preview = stripHtml(article.content).substring(0, 200);
        console.log(`   📄 Preview: "${preview}${preview.length < stripHtml(article.content).length ? "..." : ""}"`);
      }

      if (article.referencedImages.length > 0) {
        console.log(`   🖼️  Images: ${article.referencedImages.join(", ")}`);
      }
    }

    // Summary
    console.log("\n" + "═".repeat(70));
    console.log("📊 SUMMARY");
    console.log("═".repeat(70));
    console.log(`   Total articles extracted: ${result.articles.length}`);
    console.log(`   Articles with chapeau: ${result.articles.filter(a => a.chapeau).length}`);
    console.log(`   Articles with category: ${result.articles.filter(a => a.category).length}`);
    console.log(`   Multi-spread articles: ${result.articles.filter(a => a.sourceSpreadIndexes.length > 1).length}`);
    console.log(`   Total images referenced: ${result.articles.reduce((sum, a) => sum + a.referencedImages.length, 0)}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Extraction errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    console.log("\n" + "═".repeat(70));
    console.log("✅ Article extraction complete!");

  } catch (error) {
    console.error("❌ Failed to extract articles:", error);
    process.exit(1);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

main();
