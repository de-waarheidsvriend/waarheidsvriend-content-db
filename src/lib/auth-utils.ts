/**
 * Validates user credentials against environment variables.
 * Separated from auth.ts for testability (avoids NextAuth import in tests).
 */
export function validateCredentials(
  username: string | undefined,
  password: string | undefined
): { id: string; name: string } | null {
  const expectedUsername = process.env.AUTH_USERNAME
  const expectedPassword = process.env.AUTH_PASSWORD

  if (!username || !password || !expectedUsername || !expectedPassword) {
    return null
  }

  if (username === expectedUsername && password === expectedPassword) {
    return { id: "1", name: username }
  }

  return null
}
