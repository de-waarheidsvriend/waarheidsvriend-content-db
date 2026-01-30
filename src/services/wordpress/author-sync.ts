/**
 * Author Sync Service
 *
 * Synchronizes authors between the local database and WordPress.
 * Matches authors by name, creates new WP users if not found.
 */

import type { WpCredentials, WpUser } from "./types";
import { searchUsers, createUser, WordPressApiError } from "./api-client";

/**
 * Cache of WordPress users by normalized name
 */
const wpUserCache = new Map<string, WpUser>();

/**
 * Normalize an author name for matching
 * Handles variations like "Ds. J. van der Berg" vs "J. van der Berg"
 */
export function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    // Remove common Dutch titles
    .replace(/^(ds\.|dr\.|prof\.|mr\.|ir\.|drs\.|ing\.)\s*/i, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare two names for matching
 */
function namesMatch(name1: string, name2: string): boolean {
  const normalized1 = normalizeAuthorName(name1);
  const normalized2 = normalizeAuthorName(name2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }

  // Check if one contains the other (for partial matches)
  // This handles cases like "J. van der Berg" matching "Jan van der Berg"
  const words1 = normalized1.split(" ");
  const words2 = normalized2.split(" ");

  // Check if last names match and initials/first names are compatible
  if (words1.length >= 2 && words2.length >= 2) {
    const lastName1 = words1.slice(-2).join(" "); // Handle "van der Berg" etc.
    const lastName2 = words2.slice(-2).join(" ");

    if (lastName1 === lastName2) {
      return true;
    }
  }

  return false;
}

/**
 * Build a cache of all WordPress users
 * This reduces API calls when publishing multiple articles
 */
export async function buildAuthorCache(
  credentials: WpCredentials
): Promise<void> {
  wpUserCache.clear();

  try {
    // Get all users (WordPress paginates by default, we'll get the first page)
    // For most use cases, authors will be in the first 100 users
    const users = await searchUsers("", credentials);

    for (const user of users) {
      const normalizedName = normalizeAuthorName(user.name);
      wpUserCache.set(normalizedName, user);
    }

    console.log(`[AuthorSync] Cached ${wpUserCache.size} WordPress users`);
  } catch (error) {
    console.warn(
      "[AuthorSync] Failed to build author cache, will search per-author:",
      error
    );
  }
}

/**
 * Find a WordPress user by name, searching cache first
 */
async function findWpUserByName(
  name: string,
  credentials: WpCredentials
): Promise<WpUser | null> {
  const normalizedName = normalizeAuthorName(name);

  // Check cache first
  if (wpUserCache.has(normalizedName)) {
    return wpUserCache.get(normalizedName)!;
  }

  // Also check cache for similar names
  for (const [cachedName, user] of wpUserCache.entries()) {
    if (namesMatch(name, user.name)) {
      return user;
    }
  }

  // Search WordPress API
  try {
    const users = await searchUsers(name, credentials);

    for (const user of users) {
      if (namesMatch(name, user.name)) {
        // Add to cache for future lookups
        wpUserCache.set(normalizeAuthorName(user.name), user);
        return user;
      }
    }
  } catch (error) {
    console.warn(`[AuthorSync] Failed to search for user "${name}":`, error);
  }

  return null;
}

/**
 * Find or create a WordPress user for an author
 * Returns the WordPress user ID
 */
export async function findOrCreateWpUser(
  authorName: string,
  credentials: WpCredentials
): Promise<number | null> {
  // First, try to find existing user
  const existingUser = await findWpUserByName(authorName, credentials);
  if (existingUser) {
    console.log(
      `[AuthorSync] Found existing WP user for "${authorName}": ${existingUser.name} (ID: ${existingUser.id})`
    );
    return existingUser.id;
  }

  // User not found, try to create one
  try {
    // Generate a placeholder email (required by WordPress)
    const emailSlug = authorName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/, "");
    const email = `${emailSlug}@waarheidsvriend.placeholder.local`;

    const newUser = await createUser(authorName, email, credentials);

    // Add to cache
    wpUserCache.set(normalizeAuthorName(newUser.name), newUser);

    console.log(
      `[AuthorSync] Created new WP user for "${authorName}": ${newUser.name} (ID: ${newUser.id})`
    );
    return newUser.id;
  } catch (error) {
    // User creation might fail due to permissions
    if (error instanceof WordPressApiError) {
      console.warn(
        `[AuthorSync] Failed to create WP user for "${authorName}": ${error.code} - ${error.message}`
      );

      // If we can't create users, just skip the author
      // The article can still be published without an author
    } else {
      console.error(
        `[AuthorSync] Unexpected error creating WP user for "${authorName}":`,
        error
      );
    }
    return null;
  }
}

/**
 * Sync an author photo to WordPress user profile
 * Note: This requires additional WordPress configuration for user meta
 * and is optional functionality
 */
export async function syncAuthorPhoto(
  _wpUserId: number,
  _photoMediaId: number | null,
  _credentials: WpCredentials
): Promise<boolean> {
  // WordPress doesn't have a standard way to set user avatars via REST API
  // This would require a custom plugin or endpoint
  // For now, we just note that photos are uploaded to the media library

  if (_photoMediaId) {
    console.log(
      `[AuthorSync] Author photo uploaded to media library (ID: ${_photoMediaId}). ` +
        `Manual linking to user ${_wpUserId} may be required.`
    );
  }

  return true;
}

/**
 * Clear the author cache (useful for testing or long-running processes)
 */
export function clearAuthorCache(): void {
  wpUserCache.clear();
}

/**
 * Get the current size of the author cache
 */
export function getAuthorCacheSize(): number {
  return wpUserCache.size;
}
