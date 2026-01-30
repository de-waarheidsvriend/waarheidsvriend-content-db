/**
 * WordPress API Client
 *
 * HTTP client with Basic Auth for WordPress REST API communication.
 * Handles authentication, request/response formatting, and error handling.
 */

import type {
  WpCredentials,
  WpArticlePayload,
  WpArticleResponse,
  WpUser,
  WpApiError,
} from "./types";

/**
 * Create Basic Auth header value from credentials
 */
export function createAuthHeader(credentials: WpCredentials): string {
  const encoded = Buffer.from(
    `${credentials.username}:${credentials.appPassword}`
  ).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * Custom error class for WordPress API errors
 */
export class WordPressApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "WordPressApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Wrapper around fetch with WordPress authentication
 */
export async function wpFetch<T>(
  url: string,
  options: RequestInit,
  credentials: WpCredentials
): Promise<T> {
  const authHeader = createAuthHeader(credentials);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: authHeader,
    },
  });

  // Handle non-JSON responses (like 401 HTML pages)
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new WordPressApiError(
        `WordPress API error: ${response.statusText}`,
        "HTTP_ERROR",
        response.status
      );
    }
  }

  const data = await response.json();

  if (!response.ok) {
    const error = data as WpApiError;
    throw new WordPressApiError(
      error.message || `WordPress API error: ${response.statusText}`,
      error.code || "UNKNOWN_ERROR",
      error.data?.status || response.status
    );
  }

  return data as T;
}

/**
 * Get an article by its slug
 * Returns null if not found
 */
export async function getArticleBySlug(
  slug: string,
  credentials: WpCredentials
): Promise<WpArticleResponse | null> {
  // Include status=any to find drafts, pending, and published articles
  const url = `${credentials.apiUrl}/wv-articles?slug=${encodeURIComponent(slug)}&status=any`;

  try {
    const articles = await wpFetch<WpArticleResponse[]>(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      credentials
    );

    // WordPress returns an array, even for slug searches
    if (articles.length === 0) {
      return null;
    }

    return articles[0];
  } catch (error) {
    // 404 means not found, which is expected
    if (error instanceof WordPressApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new article in WordPress
 */
export async function createArticle(
  payload: WpArticlePayload,
  credentials: WpCredentials
): Promise<WpArticleResponse> {
  const url = `${credentials.apiUrl}/wv-articles`;

  return wpFetch<WpArticleResponse>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    credentials
  );
}

/**
 * Update an existing article in WordPress
 */
export async function updateArticle(
  wpPostId: number,
  payload: WpArticlePayload,
  credentials: WpCredentials
): Promise<WpArticleResponse> {
  const url = `${credentials.apiUrl}/wv-articles/${wpPostId}`;

  return wpFetch<WpArticleResponse>(
    url,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    credentials
  );
}

/**
 * Search for WordPress users by name
 */
export async function searchUsers(
  name: string,
  credentials: WpCredentials
): Promise<WpUser[]> {
  const url = `${credentials.apiUrl}/users?search=${encodeURIComponent(name)}`;

  return wpFetch<WpUser[]>(
    url,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
    credentials
  );
}

/**
 * Create a new WordPress user (for authors)
 * Note: Requires admin privileges
 */
export async function createUser(
  name: string,
  email: string,
  credentials: WpCredentials
): Promise<WpUser> {
  const url = `${credentials.apiUrl}/users`;

  // Generate a username from the name
  const username = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);

  // Generate a random password (user will need to reset)
  const password = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  return wpFetch<WpUser>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        name,
        email,
        password,
        roles: ["subscriber"], // Minimal role for authors
      }),
    },
    credentials
  );
}

/**
 * Get the currently authenticated user (for testing credentials)
 */
export async function getCurrentUser(
  credentials: WpCredentials
): Promise<WpUser> {
  const url = `${credentials.apiUrl}/users/me`;

  return wpFetch<WpUser>(
    url,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
    credentials
  );
}

/**
 * Validate WordPress credentials by checking /users/me
 */
export async function validateCredentials(
  credentials: WpCredentials
): Promise<{ valid: boolean; user?: WpUser; error?: string }> {
  try {
    const user = await getCurrentUser(credentials);
    return { valid: true, user };
  } catch (error) {
    if (error instanceof WordPressApiError) {
      return {
        valid: false,
        error: `${error.code}: ${error.message}`,
      };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get credentials from environment variables
 */
export function getCredentialsFromEnv(): WpCredentials | null {
  const apiUrl = process.env.NEXT_PUBLIC_WP_API_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  if (!apiUrl || !username || !appPassword) {
    return null;
  }

  return {
    apiUrl,
    username,
    appPassword,
  };
}
