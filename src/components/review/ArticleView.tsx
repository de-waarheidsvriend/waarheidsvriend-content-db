"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticle, type ArticleDetail, type ArticleAuthor, type ArticleImage } from "@/hooks/useArticles";

/**
 * Author display with optional photo
 */
function AuthorDisplay({ author }: { author: ArticleAuthor }) {
  return (
    <div className="flex items-center gap-3">
      {author.photoUrl ? (
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
          <Image
            src={author.photoUrl}
            alt={author.name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
          {author.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium">{author.name}</span>
    </div>
  );
}

/**
 * Featured image display with caption
 */
function FeaturedImageDisplay({ image }: { image: ArticleDetail["featuredImage"] }) {
  if (!image) return null;

  return (
    <figure className="mb-6">
      <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted">
        <Image
          src={image.url}
          alt={image.caption || "Featured image"}
          fill
          className="object-cover"
          priority
        />
      </div>
      {image.caption && (
        <figcaption className="mt-2 text-sm text-muted-foreground italic">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Gallery of article images (excluding featured)
 */
function ImageGallery({ images }: { images: ArticleImage[] }) {
  const nonFeaturedImages = images.filter((img) => !img.isFeatured);

  if (nonFeaturedImages.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Afbeeldingen</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {nonFeaturedImages.map((image) => (
          <figure key={image.id} className="group">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <Image
                src={image.url}
                alt={image.caption || "Article image"}
                fill
                className="object-cover"
              />
            </div>
            {image.caption && (
              <figcaption className="mt-2 text-sm text-muted-foreground italic">
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for article view
 */
function ArticleViewSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  );
}

/**
 * Article metadata (category, pages)
 */
function ArticleMetadata({ article }: { article: ArticleDetail }) {
  const pageRange =
    article.pageStart && article.pageEnd
      ? article.pageStart === article.pageEnd
        ? `p. ${article.pageStart}`
        : `p. ${article.pageStart}-${article.pageEnd}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {article.category && (
        <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
          {article.category}
        </span>
      )}
      {pageRange && <span>{pageRange}</span>}
    </div>
  );
}

interface ArticleViewProps {
  articleId: number;
}

/**
 * Full article view component for review interface (FR26)
 * Displays: title, chapeau, authors with photos, body content, excerpt, images
 */
export function ArticleView({ articleId }: ArticleViewProps) {
  const { data: article, isLoading, error } = useArticle(articleId);

  if (isLoading) {
    return <ArticleViewSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-destructive">Fout</h2>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Kon artikel niet laden: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!article) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Artikel niet gevonden</h2>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Dit artikel bestaat niet of is verwijderd.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        {/* Title */}
        <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>

        {/* Chapeau */}
        {article.chapeau && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {article.chapeau}
          </p>
        )}

        {/* Authors */}
        {article.authors.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {article.authors.map((author) => (
              <AuthorDisplay key={author.id} author={author} />
            ))}
          </div>
        )}

        {/* Metadata */}
        <ArticleMetadata article={article} />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Featured image */}
        <FeaturedImageDisplay image={article.featuredImage} />

        {/* Excerpt */}
        {article.excerpt && (
          <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
            <p className="text-sm italic">{article.excerpt}</p>
          </div>
        )}

        {/* Body content (rendered HTML) */}
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Image gallery (FR29) */}
        <ImageGallery images={article.images} />
      </CardContent>
    </Card>
  );
}
