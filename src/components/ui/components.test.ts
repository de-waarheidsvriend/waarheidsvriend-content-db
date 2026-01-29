import { describe, it, expect } from 'vitest'

describe('shadcn/ui components', () => {
  it('should export Button component', async () => {
    const buttonModule = await import('./button')
    expect(buttonModule.Button).toBeDefined()
    expect(typeof buttonModule.Button).toBe('function')
  })

  it('should export Card components', async () => {
    const cardModule = await import('./card')
    expect(cardModule.Card).toBeDefined()
    expect(cardModule.CardHeader).toBeDefined()
    expect(cardModule.CardTitle).toBeDefined()
    expect(cardModule.CardContent).toBeDefined()
  })

  it('should export Input component', async () => {
    const inputModule = await import('./input')
    expect(inputModule.Input).toBeDefined()
  })

  it('should export Skeleton component', async () => {
    const skeletonModule = await import('./skeleton')
    expect(skeletonModule.Skeleton).toBeDefined()
  })
})
