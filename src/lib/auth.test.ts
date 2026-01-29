import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { validateCredentials } from "./auth-utils"

describe("auth", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      AUTH_USERNAME: "testuser",
      AUTH_PASSWORD: "testpass123",
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("validateCredentials", () => {
    it("returns user object when credentials are valid", () => {
      const result = validateCredentials("testuser", "testpass123")

      expect(result).toEqual({ id: "1", name: "testuser" })
    })

    it("returns null when username is incorrect", () => {
      const result = validateCredentials("wronguser", "testpass123")

      expect(result).toBeNull()
    })

    it("returns null when password is incorrect", () => {
      const result = validateCredentials("testuser", "wrongpassword")

      expect(result).toBeNull()
    })

    it("returns null when both credentials are incorrect", () => {
      const result = validateCredentials("wronguser", "wrongpassword")

      expect(result).toBeNull()
    })

    it("returns null when username is undefined", () => {
      const result = validateCredentials(undefined, "testpass123")

      expect(result).toBeNull()
    })

    it("returns null when password is undefined", () => {
      const result = validateCredentials("testuser", undefined)

      expect(result).toBeNull()
    })

    it("returns null when both credentials are undefined", () => {
      const result = validateCredentials(undefined, undefined)

      expect(result).toBeNull()
    })

    it("returns null when AUTH_USERNAME env var is not set", () => {
      delete process.env.AUTH_USERNAME

      const result = validateCredentials("testuser", "testpass123")

      expect(result).toBeNull()
    })

    it("returns null when AUTH_PASSWORD env var is not set", () => {
      delete process.env.AUTH_PASSWORD

      const result = validateCredentials("testuser", "testpass123")

      expect(result).toBeNull()
    })

    it("returns null when credentials are empty strings", () => {
      const result = validateCredentials("", "")

      expect(result).toBeNull()
    })
  })
})
