-- CreateTable
CREATE TABLE "editions" (
    "id" SERIAL NOT NULL,
    "edition_number" INTEGER NOT NULL,
    "edition_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" SERIAL NOT NULL,
    "edition_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "chapeau" TEXT,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "category" TEXT,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "photo_url" TEXT,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_authors" (
    "article_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,

    CONSTRAINT "article_authors_pkey" PRIMARY KEY ("article_id","author_id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" SERIAL NOT NULL,
    "article_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_images" (
    "id" SERIAL NOT NULL,
    "edition_id" INTEGER NOT NULL,
    "page_number" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,

    CONSTRAINT "page_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editions_edition_number_key" ON "editions"("edition_number");

-- CreateIndex
CREATE UNIQUE INDEX "authors_name_key" ON "authors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "page_images_edition_id_page_number_key" ON "page_images"("edition_id", "page_number");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_authors" ADD CONSTRAINT "article_authors_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_authors" ADD CONSTRAINT "article_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_images" ADD CONSTRAINT "page_images_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
