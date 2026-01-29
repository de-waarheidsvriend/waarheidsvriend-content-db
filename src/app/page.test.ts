import { describe, it, expect, vi } from 'vitest'

// Mock next/navigation
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

describe('Homepage', () => {
  beforeEach(() => {
    mockRedirect.mockClear()
  })

  it('redirects to /editions', async () => {
    // Dynamic import to trigger the redirect
    try {
      const { default: Home } = await import('./page')
      Home()
    } catch (error) {
      // redirect() throws NEXT_REDIRECT which is expected behavior
      if (error instanceof Error && error.message !== 'NEXT_REDIRECT') {
        throw error
      }
    }

    expect(mockRedirect).toHaveBeenCalledWith('/editions')
  })
})
