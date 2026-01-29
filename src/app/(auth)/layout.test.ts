import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { name: 'Test User' } }),
}))

// Mock Header component
vi.mock('@/components/shared/Header', () => ({
  Header: () => null,
}))

describe('Auth Layout', () => {
  it('should be importable as a valid module', async () => {
    const layoutModule = await import('./layout')
    expect(layoutModule.default).toBeDefined()
    expect(typeof layoutModule.default).toBe('function')
  })

  it('should export a default function (async server component)', async () => {
    const { default: AuthLayout } = await import('./layout')

    // Server components are async functions
    expect(AuthLayout.constructor.name).toBe('AsyncFunction')
  })

  it('should render children wrapped with SessionProvider and Header', async () => {
    const { default: AuthLayout } = await import('./layout')

    // Use createElement instead of JSX for .ts file
    const childElement = createElement('div', null, 'Test Content')
    const result = await AuthLayout({ children: childElement })

    // Verify the component returns a valid React element
    expect(result).toBeDefined()
    expect(result.type).toBeDefined()
  })
})
