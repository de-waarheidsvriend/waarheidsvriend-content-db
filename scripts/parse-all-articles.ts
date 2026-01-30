#!/usr/bin/env npx tsx
/**
 * Parse All Articles - Exports all articles from InDesign export to JSON
 *
 * Usage: npx tsx scripts/parse-all-articles.ts
 *
 * Output: scripts/output/articles/<article-slug>.json
 *         scripts/output/articles-index.json (overview of all articles)
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ExtractedArticle } from "../src/types/index.js";

// Configuration
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const EXPORT_DIR = join(PROJECT_ROOT, "docs/single-page-export/Naamloos");
const OUTPUT_DIR = join(PROJECT_ROOT, "scripts/output/articles");

// Set UPLOADS_DIR for path validation (must be set before dynamic imports)
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || join(PROJECT_ROOT, "docs");

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

/**
 * Convert article to JSON-serializable format
 */
/**
 * Convert article to Markdown format
 */
function articleToMarkdown(article: ExtractedArticle): string {
  const lines: string[] = [];

  // Title - merge print line breaks
  const cleanTitle = article.title.replace(/\n/g, " ");
  lines.push(`# ${cleanTitle}`);
  lines.push("");

  // Metadata block
  if (article.category || article.lifespan || article.verseReference) {
    if (article.category) lines.push(`**Rubriek:** ${article.category}`);
    if (article.lifespan) lines.push(`**Levensjaren:** ${article.lifespan}`);
    if (article.verseReference) lines.push(`**Bijbeltekst:** ${article.verseReference}`);
    lines.push("");
  }

  // Chapeau/intro - merge print line breaks
  if (article.chapeau) {
    const cleanChapeau = article.chapeau.replace(/\n/g, " ");
    lines.push(`> ${cleanChapeau}`);
    lines.push("");
  }

  // Body content
  for (const block of article.bodyParagraphs) {
    // Strip HTML tags for markdown
    let text = block.content
      .replace(/<em>/g, "*")
      .replace(/<\/em>/g, "*")
      .replace(/<strong>/g, "**")
      .replace(/<\/strong>/g, "**")
      .replace(/<[^>]+>/g, "")
      .replace(/■/g, "")
      .trim();

    // Merge print line breaks (single newlines) into spaces for web
    text = text.replace(/\n/g, " ");

    if (!text) continue;

    // Clean up orphaned markdown symbols
    text = text.replace(/\*{2,}$/g, "").replace(/^\*{2,}/g, "").trim();

    switch (block.type) {
      case "subheading":
        // Remove italic markers from subheadings
        const cleanSubheading = text.replace(/^\*+|\*+$/g, "").trim();
        lines.push(`## ${cleanSubheading}`);
        break;
      case "streamer":
        // Remove existing italic markers, we'll add our own
        const cleanStreamer = text.replace(/^\*+|\*+$/g, "").trim();
        lines.push(`> *${cleanStreamer}*`);
        break;
      case "intro":
      case "paragraph":
      default:
        lines.push(text);
        break;
    }
    lines.push("");
  }

  // Author info
  if (article.authorNames.length > 0 || article.authorBio) {
    lines.push("---");
    lines.push("");
    if (article.authorNames.length > 0) {
      lines.push(`**${article.authorNames.join(", ")}**`);
    }
    if (article.authorBio) {
      // Merge print line breaks
      const cleanBio = article.authorBio.replace(/\n/g, " ");
      lines.push(`*${cleanBio}*`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function articleToJson(article: ExtractedArticle) {
  return {
    title: article.title,
    category: article.category,
    lifespan: article.lifespan,
    chapeau: article.chapeau,
    verseReference: article.verseReference,
    bodyParagraphs: article.bodyParagraphs,
    authorNames: article.authorNames,
    authorBio: article.authorBio,
    authorPhoto: article.authorPhotoFilenames.size > 0
      ? [...article.authorPhotoFilenames][0]
      : null,
    streamers: article.streamers,
    subheadings: article.subheadings,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    referencedImages: article.referencedImages,
    // Convert Map to object for JSON
    captions: Object.fromEntries(article.captions),
  };
}

async function main() {
  // Dynamic imports to ensure UPLOADS_DIR is set first
  const { loadXhtmlExport } = await import(
    "../src/services/parser/xhtml-loader.js"
  );
  const { extractArticles } = await import(
    "../src/services/parser/article-extractor.js"
  );

  console.log("=".repeat(60));
  console.log("Parse All Articles to JSON");
  console.log("=".repeat(60));
  console.log(`\nExport directory: ${EXPORT_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Load and parse using webapp components
  console.log("\nLoading export...");
  const xhtml = await loadXhtmlExport(EXPORT_DIR);
  console.log(`Loaded ${xhtml.spreads.length} spreads`);

  console.log("\nExtracting articles...");
  const result = await extractArticles(xhtml);
  console.log(`Found ${result.articles.length} articles`);

  // Clean up old output files
  if (existsSync(OUTPUT_DIR)) {
    console.log("\nCleaning up old output...");
    rmSync(OUTPUT_DIR, { recursive: true });
  }

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process each article
  const index: Array<{
    slug: string;
    title: string;
    category: string | null;
    authors: string[];
    pages: string;
    file: string;
  }> = [];

  console.log("\nExporting articles:");
  for (const article of result.articles) {
    const slug = slugify(article.title);
    const pagePrefix = String(article.pageStart).padStart(2, "0");
    const filename = `${pagePrefix}-${slug}.json`;
    const outputPath = join(OUTPUT_DIR, filename);

    const outputData = {
      ...articleToJson(article),
      _meta: {
        slug,
        parsedAt: new Date().toISOString(),
        exportDir: EXPORT_DIR,
      },
    };

    writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");

    // Write Markdown file
    const mdPath = join(OUTPUT_DIR, `${pagePrefix}-${slug}.md`);
    writeFileSync(mdPath, articleToMarkdown(article), "utf-8");

    index.push({
      slug,
      title: article.title,
      category: article.category,
      authors: article.authorNames,
      pages: `${article.pageStart}-${article.pageEnd}`,
      file: filename,
    });

    console.log(`  ✓ ${article.title} → ${filename}`);
  }

  // Write index file
  const indexPath = join(OUTPUT_DIR, "../articles-index.json");
  const indexData = {
    totalArticles: index.length,
    generatedAt: new Date().toISOString(),
    exportDir: EXPORT_DIR,
    articles: index,
  };
  writeFileSync(indexPath, JSON.stringify(indexData, null, 2), "utf-8");
  console.log(`\n✓ Index saved to: ${indexPath}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`  Total articles: ${result.articles.length}`);
  console.log(`  Output directory: ${OUTPUT_DIR}`);
  console.log(`  Index file: ${indexPath}`);
}

main().catch(console.error);
