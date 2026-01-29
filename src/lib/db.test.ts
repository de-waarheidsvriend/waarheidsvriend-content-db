import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from './db';

describe('Database Schema Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.articleAuthor.deleteMany();
    await prisma.image.deleteMany();
    await prisma.pageImage.deleteMany();
    await prisma.article.deleteMany();
    await prisma.author.deleteMany();
    await prisma.edition.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.articleAuthor.deleteMany();
    await prisma.image.deleteMany();
    await prisma.pageImage.deleteMany();
    await prisma.article.deleteMany();
    await prisma.author.deleteMany();
    await prisma.edition.deleteMany();
    await prisma.$disconnect();
  });

  describe('Edition Model (FR35)', () => {
    it('should create an edition with required fields', async () => {
      const edition = await prisma.edition.create({
        data: {
          edition_number: 1,
          edition_date: new Date('2026-01-01'),
          status: 'pending',
        },
      });

      expect(edition.id).toBeDefined();
      expect(edition.edition_number).toBe(1);
      expect(edition.status).toBe('pending');
      expect(edition.created_at).toBeInstanceOf(Date);
    });

    it('should enforce unique edition_number constraint', async () => {
      await expect(
        prisma.edition.create({
          data: {
            edition_number: 1, // Already exists
            edition_date: new Date('2026-02-01'),
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Article Model (FR36)', () => {
    it('should create an article linked to an edition', async () => {
      const edition = await prisma.edition.findFirst();
      expect(edition).not.toBeNull();

      const article = await prisma.article.create({
        data: {
          edition_id: edition!.id,
          title: 'Test Article',
          content: 'This is test content for the article.',
          chapeau: 'A brief introduction',
          excerpt: 'Article summary',
          category: 'Nieuws',
          page_start: 1,
          page_end: 3,
        },
      });

      expect(article.id).toBeDefined();
      expect(article.edition_id).toBe(edition!.id);
      expect(article.title).toBe('Test Article');
      expect(article.category).toBe('Nieuws');
    });

    it('should enforce foreign key constraint on edition_id', async () => {
      await expect(
        prisma.article.create({
          data: {
            edition_id: 99999, // Non-existent edition
            title: 'Invalid Article',
            content: 'Content',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Author Model (FR37)', () => {
    it('should create an author with required fields and timestamps', async () => {
      const author = await prisma.author.create({
        data: {
          name: 'Jan de Schrijver',
          photo_url: '/uploads/authors/jan.jpg',
        },
      });

      expect(author.id).toBeDefined();
      expect(author.name).toBe('Jan de Schrijver');
      expect(author.photo_url).toBe('/uploads/authors/jan.jpg');
      expect(author.created_at).toBeInstanceOf(Date);
      expect(author.updated_at).toBeInstanceOf(Date);
    });

    it('should enforce unique name constraint', async () => {
      await expect(
        prisma.author.create({
          data: {
            name: 'Jan de Schrijver', // Already exists
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('ArticleAuthor Model (FR38)', () => {
    it('should link article and author via join table', async () => {
      const article = await prisma.article.findFirst();
      const author = await prisma.author.findFirst();
      expect(article).not.toBeNull();
      expect(author).not.toBeNull();

      const articleAuthor = await prisma.articleAuthor.create({
        data: {
          article_id: article!.id,
          author_id: author!.id,
        },
      });

      expect(articleAuthor.article_id).toBe(article!.id);
      expect(articleAuthor.author_id).toBe(author!.id);
    });

    it('should have composite primary key', async () => {
      const article = await prisma.article.findFirst();
      const author = await prisma.author.findFirst();

      // Trying to create duplicate should fail
      await expect(
        prisma.articleAuthor.create({
          data: {
            article_id: article!.id,
            author_id: author!.id,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Image Model (FR39)', () => {
    it('should create an image linked to an article with timestamps', async () => {
      const article = await prisma.article.findFirst();
      expect(article).not.toBeNull();

      const image = await prisma.image.create({
        data: {
          article_id: article!.id,
          url: '/uploads/images/test.jpg',
          caption: 'Test image caption',
          is_featured: true,
          sort_order: 1,
        },
      });

      expect(image.id).toBeDefined();
      expect(image.article_id).toBe(article!.id);
      expect(image.is_featured).toBe(true);
      expect(image.sort_order).toBe(1);
      expect(image.created_at).toBeInstanceOf(Date);
      expect(image.updated_at).toBeInstanceOf(Date);
    });

    it('should default is_featured to false', async () => {
      const article = await prisma.article.findFirst();

      const image = await prisma.image.create({
        data: {
          article_id: article!.id,
          url: '/uploads/images/test2.jpg',
        },
      });

      expect(image.is_featured).toBe(false);
      expect(image.sort_order).toBe(0);
    });
  });

  describe('PageImage Model (FR40)', () => {
    it('should create a page image linked to an edition with timestamps', async () => {
      const edition = await prisma.edition.findFirst();
      expect(edition).not.toBeNull();

      const pageImage = await prisma.pageImage.create({
        data: {
          edition_id: edition!.id,
          page_number: 1,
          image_url: '/uploads/pages/edition-1-page-1.jpg',
        },
      });

      expect(pageImage.id).toBeDefined();
      expect(pageImage.edition_id).toBe(edition!.id);
      expect(pageImage.page_number).toBe(1);
      expect(pageImage.created_at).toBeInstanceOf(Date);
      expect(pageImage.updated_at).toBeInstanceOf(Date);
    });

    it('should enforce unique constraint on edition_id + page_number', async () => {
      const edition = await prisma.edition.findFirst();

      await expect(
        prisma.pageImage.create({
          data: {
            edition_id: edition!.id,
            page_number: 1, // Already exists for this edition
            image_url: '/uploads/pages/duplicate.jpg',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Cascade Delete (AC: #2)', () => {
    it('should cascade delete articles when edition is deleted', async () => {
      // Create a new edition with articles for this test
      const newEdition = await prisma.edition.create({
        data: {
          edition_number: 999,
          edition_date: new Date('2099-01-01'),
          articles: {
            create: {
              title: 'Article to delete',
              content: 'Content',
            },
          },
        },
        include: { articles: true },
      });

      expect(newEdition.articles).toHaveLength(1);
      const articleId = newEdition.articles[0].id;

      // Delete edition
      await prisma.edition.delete({
        where: { id: newEdition.id },
      });

      // Article should be deleted too
      const deletedArticle = await prisma.article.findUnique({
        where: { id: articleId },
      });
      expect(deletedArticle).toBeNull();
    });

    it('should cascade delete images when article is deleted', async () => {
      const edition = await prisma.edition.findFirst();

      // Create article with image
      const article = await prisma.article.create({
        data: {
          edition_id: edition!.id,
          title: 'Article with image',
          content: 'Content',
          images: {
            create: {
              url: '/uploads/cascade-test.jpg',
            },
          },
        },
        include: { images: true },
      });

      const imageId = article.images[0].id;

      // Delete article
      await prisma.article.delete({
        where: { id: article.id },
      });

      // Image should be deleted too
      const deletedImage = await prisma.image.findUnique({
        where: { id: imageId },
      });
      expect(deletedImage).toBeNull();
    });

    it('should cascade delete page_images when edition is deleted', async () => {
      // Create a new edition with page images for this test
      const newEdition = await prisma.edition.create({
        data: {
          edition_number: 998,
          edition_date: new Date('2098-01-01'),
          page_images: {
            create: {
              page_number: 1,
              image_url: '/uploads/pages/cascade-test.jpg',
            },
          },
        },
        include: { page_images: true },
      });

      expect(newEdition.page_images).toHaveLength(1);
      const pageImageId = newEdition.page_images[0].id;

      // Delete edition
      await prisma.edition.delete({
        where: { id: newEdition.id },
      });

      // PageImage should be deleted too
      const deletedPageImage = await prisma.pageImage.findUnique({
        where: { id: pageImageId },
      });
      expect(deletedPageImage).toBeNull();
    });

    it('should cascade delete article_authors when article is deleted', async () => {
      const edition = await prisma.edition.findFirst();

      // Create a new author for this test
      const author = await prisma.author.create({
        data: {
          name: 'Cascade Test Author',
        },
      });

      // Create article with author link
      const article = await prisma.article.create({
        data: {
          edition_id: edition!.id,
          title: 'Article with author link',
          content: 'Content',
          article_authors: {
            create: {
              author_id: author.id,
            },
          },
        },
        include: { article_authors: true },
      });

      expect(article.article_authors).toHaveLength(1);

      // Delete article
      await prisma.article.delete({
        where: { id: article.id },
      });

      // ArticleAuthor link should be deleted too
      const deletedLink = await prisma.articleAuthor.findUnique({
        where: {
          article_id_author_id: {
            article_id: article.id,
            author_id: author.id,
          },
        },
      });
      expect(deletedLink).toBeNull();

      // Clean up the test author
      await prisma.author.delete({ where: { id: author.id } });
    });

    it('should cascade delete article_authors when author is deleted', async () => {
      const edition = await prisma.edition.findFirst();

      // Create a new author for this test
      const author = await prisma.author.create({
        data: {
          name: 'Author To Delete',
        },
      });

      // Create article with author link
      const article = await prisma.article.create({
        data: {
          edition_id: edition!.id,
          title: 'Article linked to deletable author',
          content: 'Content',
          article_authors: {
            create: {
              author_id: author.id,
            },
          },
        },
      });

      // Delete author
      await prisma.author.delete({
        where: { id: author.id },
      });

      // ArticleAuthor link should be deleted too
      const deletedLink = await prisma.articleAuthor.findUnique({
        where: {
          article_id_author_id: {
            article_id: article.id,
            author_id: author.id,
          },
        },
      });
      expect(deletedLink).toBeNull();

      // Clean up the test article
      await prisma.article.delete({ where: { id: article.id } });
    });
  });

  describe('Table Naming Convention (AC: #4)', () => {
    it('should use snake_case table names', async () => {
      // This is validated by the fact that the migrations ran successfully
      // and we can query the tables by their snake_case names
      const result = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE '_prisma%'
        ORDER BY tablename
      `;

      const tableNames = result.map((r) => r.tablename);
      expect(tableNames).toContain('editions');
      expect(tableNames).toContain('articles');
      expect(tableNames).toContain('authors');
      expect(tableNames).toContain('article_authors');
      expect(tableNames).toContain('images');
      expect(tableNames).toContain('page_images');
    });
  });
});

describe('Prisma Client Singleton (AC: #3)', () => {
  it('should export a valid Prisma client instance', async () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
  });

  it('should be able to connect to the database', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  it('should reuse the same instance across imports', async () => {
    // Dynamic import to test singleton behavior
    const { prisma: prisma2 } = await import('./db');
    expect(prisma2).toBe(prisma);
  });
});
