import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { validateApiKey, withApiKey, unauthorizedResponse } from "./api-key"

describe("api-key", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, API_KEY: "test-api-key-12345" }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("validateApiKey", () => {
    it("returns true when API key matches", () => {
      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "test-api-key-12345" },
      })

      expect(validateApiKey(request)).toBe(true)
    })

    it("returns false when API key does not match", () => {
      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "wrong-key" },
      })

      expect(validateApiKey(request)).toBe(false)
    })

    it("returns false when API key header is missing", () => {
      const request = new NextRequest("http://localhost:3000/api/v1/test")

      expect(validateApiKey(request)).toBe(false)
    })

    it("returns false when API_KEY env var is not set", () => {
      delete process.env.API_KEY
      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "some-key" },
      })

      expect(validateApiKey(request)).toBe(false)
    })

    it("returns false when API key has different length", () => {
      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "short" },
      })

      expect(validateApiKey(request)).toBe(false)
    })
  })

  describe("unauthorizedResponse", () => {
    it("returns 401 status with error body", async () => {
      const response = unauthorizedResponse()

      expect(response.status).toBe(401)

      const body = await response.json()
      expect(body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing API key",
        },
      })
    })
  })

  describe("withApiKey", () => {
    it("calls handler when API key is valid", async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
      const wrappedHandler = withApiKey(mockHandler)

      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "test-api-key-12345" },
      })

      await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
    })

    it("returns 401 when API key is invalid", async () => {
      const mockHandler = vi.fn()
      const wrappedHandler = withApiKey(mockHandler)

      const request = new NextRequest("http://localhost:3000/api/v1/test", {
        headers: { "X-API-Key": "wrong-key" },
      })

      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)

      const body = await response.json()
      expect(body.error.code).toBe("UNAUTHORIZED")
    })

    it("returns 401 when API key is missing", async () => {
      const mockHandler = vi.fn()
      const wrappedHandler = withApiKey(mockHandler)

      const request = new NextRequest("http://localhost:3000/api/v1/test")

      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)
    })
  })
})
