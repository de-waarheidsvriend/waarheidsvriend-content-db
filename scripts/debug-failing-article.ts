import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../src/lib/db";
import { mapArticleToWpPayload } from "../src/services/wordpress/article-mapper";

async function main() {
  // Get one of the failing articles
  const article = await prisma.article.findFirst({
    where: { id: 759 }, // 'God werkt in mijn tekort'
    include: {
      edition: true,
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
    subtitle: article.subtitle,
    chapeau: article.chapeau,
    excerpt: article.excerpt,
    content: article.content,
    category: article.category,
    pageStart: article.page_start,
    pageEnd: article.page_end,
    authorBio: article.author_bio,
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

  const payload = mapArticleToWpPayload(localArticle, article.edition.edition_number, article.edition.edition_date, undefined, undefined);

  console.log("Artikel:", article.title);
  console.log("Content lengte:", article.content.length);
  console.log("Aantal components:", payload.acf.components.length);
  console.log("\nEerste 3 components:");
  for (let i = 0; i < Math.min(3, payload.acf.components.length); i++) {
    const c = payload.acf.components[i];
    console.log(`  ${i}: ${c.acf_fc_layout}`);
  }

  // Check for any suspicious content
  console.log("\nZoeken naar problematische content...");
  for (let i = 0; i < payload.acf.components.length; i++) {
    const c = payload.acf.components[i];
    const json = JSON.stringify(c);
    if (json.includes("text_image_image")) {
      console.log(`  Component ${i} bevat text_image_image:`, c);
    }
  }

  // Try to find the exact error by posting
  const apiUrl = process.env.NEXT_PUBLIC_WP_API_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  if (!apiUrl || !username || !appPassword) {
    console.log("Missing credentials");
    return;
  }

  const auth = Buffer.from(username + ":" + appPassword).toString("base64");

  console.log("\nTesting POST to WordPress...");
  const response = await fetch(apiUrl + "/wv-articles", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Status:", response.status);
  if (!response.ok) {
    console.log("Error:", JSON.stringify(data, null, 2));
  } else {
    console.log("Success! ID:", data.id);
  }
}

main().catch(console.error);
