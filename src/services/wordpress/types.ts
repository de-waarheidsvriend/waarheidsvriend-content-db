/**
 * WordPress API Types
 *
 * TypeScript interfaces for WordPress REST API communication
 * for the wv-articles custom post type with ACF Flexible Content.
 */

/**
 * WordPress API credentials
 */
export interface WpCredentials {
  apiUrl: string;
  username: string;
  appPassword: string;
}

/**
 * ACF Flexible Content component: Text
 */
export interface WpAcfTextComponent {
  acf_fc_layout: "text";
  text_text: string;
}

/**
 * ACF Flexible Content component: Quote
 */
export interface WpAcfQuoteComponent {
  acf_fc_layout: "quote";
  quote_text: string;
  quote_author: string;
}

/**
 * ACF Flexible Content component: Text with Image
 */
export interface WpAcfTextImageComponent {
  acf_fc_layout: "text_image";
  text_image_text: string;
  text_image_image: string;
  text_image_position: "center" | "left" | "right";
}

/**
 * ACF Flexible Content component: Paywall
 */
export interface WpAcfPaywallComponent {
  acf_fc_layout: "paywall";
  paywall_message: string;
}

/**
 * Union type for all ACF Flexible Content components
 */
export type WpAcfComponent =
  | WpAcfTextComponent
  | WpAcfQuoteComponent
  | WpAcfTextImageComponent
  | WpAcfPaywallComponent;

/**
 * ACF fields structure for wv-articles
 */
export interface WpAcfFields {
  article_type: "default" | "memoriam";
  article_intro: string;
  article_subtitle: string;
  article_author?: number;
  article_image?: number;
  components: WpAcfComponent[];
}

/**
 * WordPress article payload for POST/PUT requests
 */
export interface WpArticlePayload {
  title: string;
  slug: string;
  status: "draft" | "publish" | "pending" | "private";
  date_gmt: string;
  acf: WpAcfFields;
}

/**
 * WordPress Media upload result
 */
export interface WpMediaUploadResult {
  id: number;
  source_url: string;
  title: {
    rendered: string;
  };
  alt_text: string;
}

/**
 * WordPress User from REST API
 */
export interface WpUser {
  id: number;
  name: string;
  slug: string;
  avatar_urls: {
    "24"?: string;
    "48"?: string;
    "96"?: string;
  };
}

/**
 * WordPress article response from REST API
 */
export interface WpArticleResponse {
  id: number;
  date: string;
  date_gmt: string;
  slug: string;
  status: string;
  link: string;
  title: {
    rendered: string;
  };
  acf: WpAcfFields;
}

/**
 * WordPress API error response
 */
export interface WpApiError {
  code: string;
  message: string;
  data?: {
    status: number;
  };
}

/**
 * Result of publishing a single article
 */
export interface ArticlePublishResult {
  articleId: number;
  title: string;
  success: boolean;
  wpPostId?: number;
  wpSlug?: string;
  error?: string;
  created: boolean; // true = new article, false = updated existing
}

/**
 * Overall result of publishing an edition
 */
export interface PublishResult {
  success: boolean;
  editionId: number;
  articlesPublished: number;
  articlesSkipped: number;
  articlesFailed: number;
  results: ArticlePublishResult[];
  errors: string[];
  dryRun: boolean;
}

/**
 * Progress callback data during publishing
 */
export interface PublishProgress {
  current: number;
  total: number;
  currentArticle: string;
  status: "uploading_image" | "syncing_author" | "publishing" | "completed" | "failed";
}

/**
 * Options for the publish function
 */
export interface PublishOptions {
  dryRun?: boolean;
  onProgress?: (progress: PublishProgress) => void;
}

/**
 * Local article data from database (for mapping)
 */
export interface LocalArticleData {
  id: number;
  title: string;
  chapeau: string | null;
  excerpt: string | null;
  content: string;
  category: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  authors: Array<{
    id: number;
    name: string;
    photoUrl: string | null;
  }>;
  images: Array<{
    id: number;
    url: string;
    caption: string | null;
    isFeatured: boolean;
    sortOrder: number;
  }>;
}

/**
 * Edition data from database (for publishing)
 */
export interface LocalEditionData {
  id: number;
  editionNumber: number;
  editionDate: Date;
  status: string;
  articles: LocalArticleData[];
}
