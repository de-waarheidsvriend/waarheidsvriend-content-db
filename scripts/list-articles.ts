import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

import { prisma } from "@/lib/db";

async function main() {
  const editionId = parseInt(process.argv[2] || "423", 10);

  const articles = await prisma.article.findMany({
    where: { edition_id: editionId },
    select: { id: true, title: true },
    orderBy: { id: "asc" }
  });

  console.log(`\nArtikelen in editie ${editionId}:\n`);
  for (const a of articles) {
    console.log(`ID: ${a.id} | ${a.title.substring(0, 50)}`);
  }
}

main().then(() => process.exit(0));
