-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "author_bio" TEXT;

-- AlterTable
ALTER TABLE "editions" ADD COLUMN     "cover_headlines" JSONB;
