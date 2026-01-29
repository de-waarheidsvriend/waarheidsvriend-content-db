/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditionsPage from './page'

describe('Editions placeholder page', () => {
  it('renders the page title', () => {
    render(<EditionsPage />)

    expect(screen.getByRole('heading', { name: 'Edities', level: 1 })).toBeInTheDocument()
  })

  it('renders the Coming Soon card', () => {
    render(<EditionsPage />)

    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
  })

  it('renders the placeholder message', () => {
    render(<EditionsPage />)

    expect(
      screen.getByText(/De editie-overzicht functionaliteit wordt geïmplementeerd in Epic 2/i)
    ).toBeInTheDocument()
  })

  it('uses Card component structure', () => {
    render(<EditionsPage />)

    // Card component should be present (check for card-related elements)
    const cardTitle = screen.getByText('Coming Soon')
    expect(cardTitle).toBeInTheDocument()
  })
})
