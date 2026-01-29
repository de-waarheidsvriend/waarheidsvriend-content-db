/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'

// Mock next-auth/react
const mockSignOut = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: () => mockSignOut(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('Header component', () => {
  beforeEach(() => {
    mockSignOut.mockClear()
  })

  it('renders the application name', () => {
    render(<Header />)

    expect(screen.getByText('Waarheidsvriend Content DB')).toBeInTheDocument()
  })

  it('renders navigation link to editions', () => {
    render(<Header />)

    const editionsLink = screen.getByRole('link', { name: 'Edities' })
    expect(editionsLink).toBeInTheDocument()
    expect(editionsLink).toHaveAttribute('href', '/editions')
  })

  it('renders logout button', () => {
    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: 'Uitloggen' })
    expect(logoutButton).toBeInTheDocument()
  })

  it('calls signOut when logout button is clicked', () => {
    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: 'Uitloggen' })
    fireEvent.click(logoutButton)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('has sticky header styling', () => {
    render(<Header />)

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('sticky', 'top-0')
  })

  it('renders home link with application name', () => {
    render(<Header />)

    const homeLink = screen.getByRole('link', { name: 'Waarheidsvriend Content DB' })
    expect(homeLink).toHaveAttribute('href', '/')
  })
})
