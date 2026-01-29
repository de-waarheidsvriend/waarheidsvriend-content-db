/*
  Warnings:

  - Added the required column `updated_at` to the `authors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `images` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `page_images` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "authors" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "page_images" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
