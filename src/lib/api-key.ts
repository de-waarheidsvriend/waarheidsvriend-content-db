import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Validates the API key from the X-API-Key header against the configured API_KEY.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-API-Key")
  const expectedKey = process.env.API_KEY

  if (!apiKey || !expectedKey) {
    return false
  }

  // Timing-safe comparison to prevent timing attacks
  if (apiKey.length !== expectedKey.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ expectedKey.charCodeAt(i)
  }

  return result === 0
}

/**
 * Standard unauthorized response for API endpoints.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing API key",
      },
    },
    { status: 401 }
  )
}

/**
 * Higher-order function that wraps a route handler with API key validation.
 * Returns 401 Unauthorized if the API key is invalid or missing.
 */
export function withApiKey(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (!validateApiKey(req)) {
      return unauthorizedResponse()
    }
    return handler(req)
  }
}
