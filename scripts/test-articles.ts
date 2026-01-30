import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadXhtmlExport } from "@/services/parser/xhtml-loader";
import { extractArticles } from "@/services/parser/article-extractor";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

async function main() {
  const exportDir = join(PROJECT_ROOT, "docs/single-page-export/Naamloos");

  const xhtmlExport = await loadXhtmlExport(exportDir);
  const { articles } = await extractArticles(xhtmlExport);

  console.log(`\nAantal artikelen: ${articles.length}\n`);
  console.log("Titel".padEnd(50) + "Pagina's");
  console.log("-".repeat(60));

  for (const article of articles) {
    const title = article.title.replace(/\n/g, " ").substring(0, 48);
    const pages = `${article.pageStart}-${article.pageEnd}`;
    console.log(title.padEnd(50) + pages);
  }
}

main().catch(console.error);
