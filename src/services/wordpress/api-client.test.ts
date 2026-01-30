/**
 * Tests for WordPress API Client
 *
 * Tests auth header generation and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAuthHeader,
  WordPressApiError,
  wpFetch,
  getArticleBySlug,
  validateCredentials,
  getCredentialsFromEnv,
} from "./api-client";
import type { WpCredentials, WpArticleResponse } from "./types";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCredentials: WpCredentials = {
  apiUrl: "https://example.com/wp-json/wp/v2",
  username: "testuser",
  appPassword: "xxxx xxxx xxxx",
};

describe("createAuthHeader", () => {
  it("creates Basic auth header from credentials", () => {
    const result = createAuthHeader(mockCredentials);

    // Expected: Basic base64(testuser:xxxx xxxx xxxx)
    const expectedBase64 = Buffer.from("testuser:xxxx xxxx xxxx").toString("base64");
    expect(result).toBe(`Basic ${expectedBase64}`);
  });

  it("handles special characters in password", () => {
    const credentials: WpCredentials = {
      ...mockCredentials,
      appPassword: "p@ss:word/test",
    };

    const result = createAuthHeader(credentials);

    const expectedBase64 = Buffer.from("testuser:p@ss:word/test").toString("base64");
    expect(result).toBe(`Basic ${expectedBase64}`);
  });
});

describe("WordPressApiError", () => {
  it("creates error with correct properties", () => {
    const error = new WordPressApiError("Not found", "rest_not_found", 404);

    expect(error.message).toBe("Not found");
    expect(error.code).toBe("rest_not_found");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("WordPressApiError");
  });

  it("is instanceof Error", () => {
    const error = new WordPressApiError("Test", "test", 500);

    expect(error).toBeInstanceOf(Error);
  });
});

describe("wpFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("adds authorization header to request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "test" }),
    });

    await wpFetch("https://example.com/test", { method: "GET" }, mockCredentials);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/test",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      })
    );
  });

  it("returns parsed JSON on success", async () => {
    const responseData = { id: 1, name: "Test" };
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(responseData),
    });

    const result = await wpFetch("https://example.com/test", { method: "GET" }, mockCredentials);

    expect(result).toEqual(responseData);
  });

  it("throws WordPressApiError on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({
        code: "rest_forbidden",
        message: "You are not authorized",
        data: { status: 401 },
      }),
    });

    await expect(
      wpFetch("https://example.com/test", { method: "GET" }, mockCredentials)
    ).rejects.toThrow(WordPressApiError);
  });

  it("throws WordPressApiError on non-JSON error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers({ "content-type": "text/html" }),
    });

    await expect(
      wpFetch("https://example.com/test", { method: "GET" }, mockCredentials)
    ).rejects.toThrow(WordPressApiError);
  });
});

describe("getArticleBySlug", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns article when found", async () => {
    const mockArticle: WpArticleResponse = {
      id: 123,
      date: "2025-01-30T09:00:00",
      date_gmt: "2025-01-30T08:00:00",
      slug: "test-article",
      status: "draft",
      link: "https://example.com/wv-articles/test-article/",
      title: { rendered: "Test Article" },
      acf: {
        article_type: "default",
        article_intro: "Intro",
        article_subtitle: "",
        components: [],
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve([mockArticle]),
    });

    const result = await getArticleBySlug("test-article", mockCredentials);

    expect(result).toEqual(mockArticle);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("wv-articles?slug=test-article"),
      expect.any(Object)
    );
  });

  it("returns null when article not found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve([]),
    });

    const result = await getArticleBySlug("nonexistent", mockCredentials);

    expect(result).toBeNull();
  });

  it("returns null on 404 error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({
        code: "rest_not_found",
        message: "Not found",
        data: { status: 404 },
      }),
    });

    const result = await getArticleBySlug("nonexistent", mockCredentials);

    expect(result).toBeNull();
  });

  it("encodes slug in URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve([]),
    });

    await getArticleBySlug("test article", mockCredentials);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("slug=test%20article"),
      expect.any(Object)
    );
  });
});

describe("validateCredentials", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns valid: true with user on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({
        id: 1,
        name: "Test User",
        slug: "test-user",
        avatar_urls: {},
      }),
    });

    const result = await validateCredentials(mockCredentials);

    expect(result.valid).toBe(true);
    expect(result.user?.name).toBe("Test User");
    expect(result.error).toBeUndefined();
  });

  it("returns valid: false with error on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({
        code: "rest_forbidden",
        message: "Invalid credentials",
        data: { status: 401 },
      }),
    });

    const result = await validateCredentials(mockCredentials);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("rest_forbidden");
    expect(result.user).toBeUndefined();
  });
});

describe("getCredentialsFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns credentials when all env vars present", () => {
    process.env.NEXT_PUBLIC_WP_API_URL = "https://example.com/wp-json/wp/v2";
    process.env.WP_USERNAME = "user";
    process.env.WP_APP_PASSWORD = "pass";

    const result = getCredentialsFromEnv();

    expect(result).toEqual({
      apiUrl: "https://example.com/wp-json/wp/v2",
      username: "user",
      appPassword: "pass",
    });
  });

  it("returns null when API URL missing", () => {
    process.env.WP_USERNAME = "user";
    process.env.WP_APP_PASSWORD = "pass";
    delete process.env.NEXT_PUBLIC_WP_API_URL;

    const result = getCredentialsFromEnv();

    expect(result).toBeNull();
  });

  it("returns null when username missing", () => {
    process.env.NEXT_PUBLIC_WP_API_URL = "https://example.com";
    process.env.WP_APP_PASSWORD = "pass";
    delete process.env.WP_USERNAME;

    const result = getCredentialsFromEnv();

    expect(result).toBeNull();
  });

  it("returns null when password missing", () => {
    process.env.NEXT_PUBLIC_WP_API_URL = "https://example.com";
    process.env.WP_USERNAME = "user";
    delete process.env.WP_APP_PASSWORD;

    const result = getCredentialsFromEnv();

    expect(result).toBeNull();
  });
});
