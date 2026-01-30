import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../src/lib/db";
import { mapArticleToWpPayload } from "../src/services/wordpress/article-mapper";

async function main() {
  const article = await prisma.article.findFirst({
    where: { edition_id: 420 },
    include: {
      article_authors: { include: { author: true } },
      images: { orderBy: { sort_order: "asc" } }
    }
  });

  if (!article) {
    console.log("Geen artikel gevonden");
    return;
  }

  const localArticle = {
    id: article.id,
    title: article.title,
    chapeau: article.chapeau,
    excerpt: article.excerpt,
    content: article.content,
    category: article.category,
    pageStart: article.page_start,
    pageEnd: article.page_end,
    authors: article.article_authors.map(aa => ({
      id: aa.author.id,
      name: aa.author.name,
      photoUrl: aa.author.photo_url
    })),
    images: article.images.map(img => ({
      id: img.id,
      url: img.url,
      caption: img.caption,
      isFeatured: img.is_featured,
      sortOrder: img.sort_order
    }))
  };

  const payload = mapArticleToWpPayload(localArticle, -746781107, undefined, undefined);

  console.log("Artikel:", article.title);
  console.log("\nPayload:", JSON.stringify(payload, null, 2));
}

main().catch(console.error);
