#!/usr/bin/env npx ts-node
/**
 * Debug script for analyzing edition parsing results
 *
 * This script helps debug issues with article extraction by:
 * 1. Loading the XHTML export for a given edition
 * 2. Running the parser and showing detected classes
 * 3. Displaying extracted articles with their metadata
 * 4. Highlighting potential issues
 *
 * Usage: npx ts-node scripts/debug-edition-parsing.ts <edition-folder-path>
 * Example: npx ts-node scripts/debug-edition-parsing.ts uploads/editions/412/xhtml/05\ De\ Waarheidsvriend\ 5-2
 */

import { loadXhtmlExport } from '../src/services/parser/xhtml-loader';
import { extractArticles } from '../src/services/parser/article-extractor';
import { join } from 'path';

// Bypass path validation for debug script
process.env.UPLOADS_DIR = '.';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(message: string, color?: keyof typeof COLORS) {
  if (color) {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
  } else {
    console.log(message);
  }
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bold');
  console.log('='.repeat(80));
}

function logSubsection(title: string) {
  console.log('\n' + '-'.repeat(60));
  log(title, 'cyan');
  console.log('-'.repeat(60));
}

async function debugEditionParsing(xhtmlPath: string) {
  const fullPath = xhtmlPath.startsWith('/') ? xhtmlPath : join(process.cwd(), xhtmlPath);

  logSection(`Debugging Edition Parsing: ${fullPath}`);

  // Step 1: Load XHTML Export (includes style analysis)
  logSubsection('Step 1: Loading XHTML Export');

  const xhtmlExport = await loadXhtmlExport(fullPath);

  // Use the styles from the loaded export
  const styles = xhtmlExport.styles;

  log('\nActual Detected Classes (from export):', 'green');
  log(`  Title classes: ${styles.titleClasses.join(', ') || 'NONE'}`, styles.titleClasses.length ? 'green' : 'red');
  log(`  Chapeau classes: ${styles.chapeauClasses.join(', ') || 'NONE'}`);
  log(`  Body classes: ${styles.bodyClasses.join(', ') || 'NONE'}`);
  log(`  Author classes: ${styles.authorClasses.join(', ') || 'NONE'}`);
  log(`  Category classes: ${styles.categoryClasses.join(', ') || 'NONE'}`);
  log(`  Subheading classes: ${styles.subheadingClasses.join(', ') || 'NONE'}`);
  log(`  Streamer classes: ${styles.streamerClasses.join(', ') || 'NONE'}`);
  log(`  Sidebar classes: ${styles.sidebarClasses.join(', ') || 'NONE'}`);
  log(`  Caption classes: ${styles.captionClasses.join(', ') || 'NONE'}`);

  // Check for potential issues
  log('\nPotential Issues with Classes:', 'yellow');

  // Check for cover classes being misidentified as titles
  const coverTitleClasses = styles.titleClasses.filter(c =>
    c.toLowerCase().includes('omslag') ||
    c.toLowerCase().includes('cover')
  );
  if (coverTitleClasses.length > 0) {
    log(`  WARNING: Cover classes detected as titles: ${coverTitleClasses.join(', ')}`, 'red');
    log(`    These should be excluded from article extraction!`, 'red');
  }

  // Check for TOC classes
  const tocTitleClasses = styles.titleClasses.filter(c =>
    c.toLowerCase().includes('toc') ||
    c.toLowerCase().includes('inhoud')
  );
  if (tocTitleClasses.length > 0) {
    log(`  WARNING: TOC classes detected as titles: ${tocTitleClasses.join(', ')}`, 'yellow');
  }

  log(`\nLoaded ${xhtmlExport.spreads.length} spreads:`, 'green');
  for (const spread of xhtmlExport.spreads) {
    log(`  Spread ${spread.spreadIndex}: pages ${spread.pageStart}-${spread.pageEnd} (${spread.filename})`);
  }

  // Step 2: Extract Articles
  logSubsection('Step 2: Article Extraction');

  const { articles, errors } = await extractArticles(xhtmlExport);

  if (errors.length > 0) {
    log(`\nExtraction Errors (${errors.length}):`, 'red');
    for (const error of errors) {
      log(`  - ${error}`, 'red');
    }
  }

  log(`\nExtracted ${articles.length} articles:`, 'green');

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log('\n' + '~'.repeat(60));
    log(`Article ${i + 1}: ${article.title}`, 'bold');
    console.log('~'.repeat(60));

    log(`  Pages: ${article.pageStart}-${article.pageEnd}`);
    log(`  Category: ${article.category || '(none)'}`);
    log(`  Chapeau: ${article.chapeau?.substring(0, 100) || '(none)'}${article.chapeau && article.chapeau.length > 100 ? '...' : ''}`);
    log(`  Excerpt: ${article.excerpt?.substring(0, 100) || '(none)'}${article.excerpt && article.excerpt.length > 100 ? '...' : ''}`);
    log(`  Content length: ${article.content.length} chars`);
    log(`  Streamers: ${article.streamers.length > 0 ? article.streamers.join(', ').substring(0, 100) : '(none)'}`);
    log(`  Subheadings: ${article.subheadings.length > 0 ? article.subheadings.join(', ').substring(0, 100) : '(none)'}`);
    log(`  Sidebars: ${article.sidebars.length} blocks`);
    log(`  Referenced images: ${article.referencedImages.length > 0 ? article.referencedImages.join(', ') : '(none)'}`);
    log(`  Source spreads: ${article.sourceSpreadIndexes.join(', ')}`);

    // Check for potential issues with this article
    const issues: string[] = [];

    // Issue: Cover content detected as article
    if (article.pageStart === 1 && article.pageEnd === 1) {
      issues.push('Article on cover page (page 1) - may be cover metadata');
    }

    // Issue: Title looks like cover teaser
    if (article.title.toLowerCase().includes('|') && article.title.toLowerCase().includes('p.')) {
      issues.push('Title contains page reference - may be cover teaser');
    }

    // Issue: Too many images (may include TOC images)
    if (article.referencedImages.length > 5) {
      issues.push(`Many images (${article.referencedImages.length}) - may include unrelated images`);
    }

    // Issue: Page range spans multiple spreads without clear reason
    if (article.pageEnd - article.pageStart > 3) {
      issues.push(`Large page range (${article.pageEnd - article.pageStart + 1} pages) - check merge logic`);
    }

    // Issue: No content
    if (article.content.length < 100) {
      issues.push('Very short content - may be metadata only');
    }

    // Issue: Content starts with intro text that should be chapeau
    if (!article.chapeau && article.excerpt) {
      const excerptLower = article.excerpt.toLowerCase();
      if (excerptLower.includes('deze ') && (excerptLower.includes('meditatie') || excerptLower.includes('artikel'))) {
        issues.push('Excerpt looks like intro text - chapeau may be missing');
      }
    }

    if (issues.length > 0) {
      log(`  ISSUES:`, 'yellow');
      for (const issue of issues) {
        log(`    - ${issue}`, 'yellow');
      }
    }

    // Show first part of content for verification
    if (article.content) {
      log(`  Content preview:`, 'dim');
      const preview = article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
      log(`    "${preview}..."`, 'dim');
    }
  }

  // Summary
  logSection('Summary');
  log(`Total articles: ${articles.length}`);
  log(`Extraction errors: ${errors.length}`);

  const articlesWithStreamers = articles.filter(a => a.streamers.length > 0).length;
  const articlesWithSidebars = articles.filter(a => a.sidebars.length > 0).length;
  const articlesWithChapeau = articles.filter(a => a.chapeau).length;
  const articlesWithCategory = articles.filter(a => a.category).length;

  log(`Articles with chapeau: ${articlesWithChapeau}`);
  log(`Articles with category: ${articlesWithCategory}`);
  log(`Articles with streamers: ${articlesWithStreamers}`);
  log(`Articles with sidebars: ${articlesWithSidebars}`);

  // Check for known problematic patterns
  const coverArticles = articles.filter(a => a.pageStart === 1);
  if (coverArticles.length > 0) {
    log(`\nWARNING: ${coverArticles.length} article(s) starting on cover page (likely metadata):`, 'red');
    for (const a of coverArticles) {
      log(`  - "${a.title}"`, 'red');
    }
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx ts-node scripts/debug-edition-parsing.ts <xhtml-folder-path>');
  console.log('Example: npx ts-node scripts/debug-edition-parsing.ts "uploads/editions/412/xhtml/05 De Waarheidsvriend 5-2"');
  process.exit(1);
}

debugEditionParsing(args[0]).catch(console.error);
