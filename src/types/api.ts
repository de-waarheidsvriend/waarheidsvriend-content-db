/**
 * Shared API types for v1 endpoints
 */

/**
 * Strict status type for edition processing states
 */
export type EditionStatus =
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "pending"
  | "failed";

/**
 * Edition summary for list view (GET /api/v1/editions)
 */
export interface EditionSummary {
  id: string;
  editionNumber: number;
  editionDate: string;
  articleCount: number;
  status: EditionStatus;
}

/**
 * Edition detail for single edition view (GET /api/v1/editions/[id])
 */
export interface EditionDetail {
  id: string;
  editionNumber: number;
  editionDate: string;
  articleCount: number;
  status: EditionStatus;
}

/**
 * Article summary for edition articles list (GET /api/v1/editions/[id]/articles)
 */
export interface ArticleSummary {
  id: string;
  title: string;
  chapeau: string | null;
  category: string | null;
  pageStart: number | null;
  pageEnd: number | null;
}

/**
 * Standard API error response
 */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Error response wrapper
 */
export interface ErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Generic API response type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Pagination metadata for list endpoints
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated success response wrapper
 */
export interface PaginatedSuccessResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Paginated API response type
 */
export type PaginatedApiResponse<T> = PaginatedSuccessResponse<T> | ErrorResponse;
