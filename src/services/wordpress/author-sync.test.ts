/**
 * Tests for Author Sync Service
 *
 * Tests name normalization and matching logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeAuthorName,
  buildAuthorCache,
  findOrCreateWpUser,
  clearAuthorCache,
  getAuthorCacheSize,
} from "./author-sync";
import * as apiClient from "./api-client";
import type { WpCredentials, WpUser } from "./types";

// Mock the api-client module
vi.mock("./api-client", () => ({
  searchUsers: vi.fn(),
  createUser: vi.fn(),
  WordPressApiError: class WordPressApiError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = "WordPressApiError";
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

const mockCredentials: WpCredentials = {
  apiUrl: "https://example.com/wp-json/wp/v2",
  username: "test",
  appPassword: "test",
};

const mockUser: WpUser = {
  id: 42,
  name: "J. van der Berg",
  slug: "j-van-der-berg",
  avatar_urls: {},
};

describe("normalizeAuthorName", () => {
  it("converts to lowercase", () => {
    expect(normalizeAuthorName("JOHN DOE")).toBe("john doe");
  });

  it("removes Ds. title", () => {
    expect(normalizeAuthorName("Ds. J. van der Berg")).toBe("j. van der berg");
  });

  it("removes Dr. title", () => {
    expect(normalizeAuthorName("Dr. A. Smith")).toBe("a. smith");
  });

  it("removes Prof. title", () => {
    expect(normalizeAuthorName("Prof. B. Johnson")).toBe("b. johnson");
  });

  it("removes Mr. title", () => {
    expect(normalizeAuthorName("Mr. C. Davis")).toBe("c. davis");
  });

  it("removes Ir. title", () => {
    expect(normalizeAuthorName("Ir. D. Williams")).toBe("d. williams");
  });

  it("removes Drs. title", () => {
    expect(normalizeAuthorName("Drs. E. Brown")).toBe("e. brown");
  });

  it("removes Ing. title", () => {
    expect(normalizeAuthorName("Ing. F. Miller")).toBe("f. miller");
  });

  it("normalizes extra whitespace", () => {
    expect(normalizeAuthorName("  John   Doe  ")).toBe("john doe");
  });

  it("handles names without titles", () => {
    expect(normalizeAuthorName("Jan Janssen")).toBe("jan janssen");
  });
});

describe("buildAuthorCache", () => {
  beforeEach(() => {
    clearAuthorCache();
    vi.clearAllMocks();
  });

  it("populates cache with WordPress users", async () => {
    const mockUsers: WpUser[] = [
      { id: 1, name: "User One", slug: "user-one", avatar_urls: {} },
      { id: 2, name: "User Two", slug: "user-two", avatar_urls: {} },
    ];
    vi.mocked(apiClient.searchUsers).mockResolvedValue(mockUsers);

    await buildAuthorCache(mockCredentials);

    expect(getAuthorCacheSize()).toBe(2);
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(apiClient.searchUsers).mockRejectedValue(new Error("API error"));

    // Should not throw
    await buildAuthorCache(mockCredentials);

    expect(getAuthorCacheSize()).toBe(0);
  });
});

describe("findOrCreateWpUser", () => {
  beforeEach(() => {
    clearAuthorCache();
    vi.clearAllMocks();
  });

  it("returns existing user ID when found by search", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([mockUser]);

    const result = await findOrCreateWpUser("J. van der Berg", mockCredentials);

    expect(result).toBe(42);
    expect(apiClient.createUser).not.toHaveBeenCalled();
  });

  it("creates new user when not found", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([]);
    vi.mocked(apiClient.createUser).mockResolvedValue({
      id: 99,
      name: "New Author",
      slug: "new-author",
      avatar_urls: {},
    });

    const result = await findOrCreateWpUser("New Author", mockCredentials);

    expect(result).toBe(99);
    expect(apiClient.createUser).toHaveBeenCalledWith(
      "New Author",
      expect.stringContaining("new.author@"),
      mockCredentials
    );
  });

  it("returns null when user creation fails", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([]);
    vi.mocked(apiClient.createUser).mockRejectedValue(
      new apiClient.WordPressApiError("Forbidden", "rest_forbidden", 403)
    );

    const result = await findOrCreateWpUser("New Author", mockCredentials);

    expect(result).toBeNull();
  });

  it("uses cache for subsequent lookups", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([mockUser]);

    // First call
    await findOrCreateWpUser("J. van der Berg", mockCredentials);

    // Reset mock to verify it's not called again
    vi.mocked(apiClient.searchUsers).mockClear();

    // Second call should use cache
    const result = await findOrCreateWpUser("J. van der Berg", mockCredentials);

    expect(result).toBe(42);
    expect(apiClient.searchUsers).not.toHaveBeenCalled();
  });

  it("matches names with different titles", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([mockUser]);

    // Search with title
    const result = await findOrCreateWpUser("Ds. J. van der Berg", mockCredentials);

    // Should match user without title
    expect(result).toBe(42);
  });
});

describe("clearAuthorCache", () => {
  it("empties the cache", async () => {
    vi.mocked(apiClient.searchUsers).mockResolvedValue([mockUser]);
    await buildAuthorCache(mockCredentials);

    expect(getAuthorCacheSize()).toBeGreaterThan(0);

    clearAuthorCache();

    expect(getAuthorCacheSize()).toBe(0);
  });
});
