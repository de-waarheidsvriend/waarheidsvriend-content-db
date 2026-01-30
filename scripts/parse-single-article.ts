#!/usr/bin/env npx tsx
/**
 * Single Article Parser for InDesign Single Page HTML Export
 *
 * Uses the webapp's parser components to extract articles from single-page exports.
 *
 * Usage: UPLOADS_DIR=./docs npx tsx scripts/parse-single-article.ts [article-title]
 *
 * Output: scripts/output/<article-slug>.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadXhtmlExport } from "../src/services/parser/xhtml-loader.js";
import { extractArticles } from "../src/services/parser/article-extractor.js";
import type { ExtractedArticle } from "../src/types/index.js";

// Configuration
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const EXPORT_DIR = join(PROJECT_ROOT, "docs/single-page-export/Naamloos");
const OUTPUT_DIR = join(PROJECT_ROOT, "scripts/output");
const TARGET_ARTICLE = process.argv[2] || "'k Sluit mijn oogjes";

/**
 * Convert article to JSON-serializable format
 */
function articleToJson(article: ExtractedArticle) {
  return {
    title: article.title,
    category: article.category,
    chapeau: article.chapeau,
    verseReference: article.verseReference,
    intro: article.intro,
    bodyParagraphs: article.bodyParagraphs,
    excerpt: article.excerpt,
    authorNames: article.authorNames,
    authorBio: article.authorBio,
    streamers: article.streamers,
    subheadings: article.subheadings,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    referencedImages: article.referencedImages,
    // Convert Map to object for JSON
    captions: Object.fromEntries(article.captions),
  };
}

/**
 * Create URL-friendly slug from title
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Single Article Parser (using webapp components)");
  console.log("=".repeat(60));
  console.log(`\nTarget: "${TARGET_ARTICLE}"`);
  console.log(`Export: ${EXPORT_DIR}`);

  // Load and parse using webapp components
  console.log("\nLoading export...");
  const xhtml = await loadXhtmlExport(EXPORT_DIR);
  console.log(`Loaded ${xhtml.spreads.length} spreads`);

  console.log("\nExtracting articles...");
  const result = await extractArticles(xhtml);
  console.log(`Found ${result.articles.length} articles`);

  // Find target article
  const normalizeApostrophes = (s: string) =>
    s.toLowerCase().replace(/[\u2018\u2019\u0027\u2032]/g, "'");

  const article = result.articles.find((a) =>
    normalizeApostrophes(a.title).includes(normalizeApostrophes(TARGET_ARTICLE))
  );

  if (!article) {
    console.error(`\nArticle "${TARGET_ARTICLE}" not found.`);
    console.log("\nAvailable articles:");
    result.articles.forEach((a) => console.log(`  - ${a.title}`));
    process.exit(1);
  }

  // Display summary
  console.log("\n" + "=".repeat(60));
  console.log(`FOUND: "${article.title}"`);
  console.log("=".repeat(60));
  console.log(`  Category: ${article.category || "(none)"}`);
  console.log(`  Verse Reference: ${article.verseReference || "(none)"}`);
  console.log(`  Chapeau: ${article.chapeau?.substring(0, 50) || "(none)"}...`);
  console.log(`  Authors: ${article.authorNames.join(", ") || "(none)"}`);
  console.log(`  Author Bio: ${article.authorBio || "(none)"}`);
  console.log(`  Streamers: ${article.streamers.length}`);
  console.log(`  Subheadings: ${article.subheadings.length}`);
  console.log(`  Images: ${article.referencedImages.length}`);
  console.log(`  Pages: ${article.pageStart}-${article.pageEnd}`);
  console.log(`  Excerpt: ${article.excerpt?.substring(0, 80) || "(none)"}...`);

  // Save to JSON
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const slug = slugify(article.title);
  const outputPath = join(OUTPUT_DIR, `${slug}.json`);

  const outputData = {
    ...articleToJson(article),
    _meta: {
      parsedAt: new Date().toISOString(),
      exportDir: EXPORT_DIR,
      searchQuery: TARGET_ARTICLE,
    },
  };

  writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`\nSaved to: ${outputPath}`);
}

main().catch(console.error);
