/**
 * Author Sync Service
 *
 * Synchronizes authors between the local database and WordPress.
 * Matches authors by name, creates new WP users if not found.
 *
 * TODO: Toekomstige implementatie - auteurs koppelen via "authors" custom post type
 * De huidige wp_users aanpak werkt niet (geen permissies voor rest_cannot_create_user).
 * Zodra de "authors" post type REST API beschikbaar is:
 * 1. Zoek auteur op naam in /wp/v2/authors endpoint
 * 2. Koppel via article_author ACF veld (array van post IDs)
 * 3. Verwijder het fallback tekstblok uit de article-mapper
 *
 * Huidige workaround: Auteur info wordt als tekstblok aan het artikel toegevoegd.
 * Zie: createAuthorBlock() in article-mapper.ts
 */

import type { WpCredentials, WpUser } from "./types";
import { searchUsers } from "./api-client";

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
 *
 * NOTE: User creation is temporarily disabled due to WordPress permission issues
 * (rest_cannot_create_user). Authors are now displayed via a fallback text block.
 * See createAuthorBlock() in article-mapper.ts
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

  // TODO: User creation disabled - WordPress returns rest_cannot_create_user
  // Auteur info wordt nu als tekstblok aan het artikel toegevoegd (fallback).
  // Zie createAuthorBlock() in article-mapper.ts
  console.log(
    `[AuthorSync] Skipped user creation for "${authorName}" (fallback active)`
  );
  return null;
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
