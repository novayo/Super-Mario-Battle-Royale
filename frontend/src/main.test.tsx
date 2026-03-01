import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode } from 'react'

// Mock App component
vi.mock('./App', () => ({
  default: () => <div>Mocked App</div>,
}))

const mockRender = vi.fn()
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn().mockImplementation(() => ({
    render: mockRender,
  })),
}))

describe('main.tsx', () => {
  beforeEach(() => {
    // Reset the DOM and mocks before each test
    document.body.innerHTML = '<div id="root"></div>'
    vi.resetModules()
  })

  it('renders the App component into the root element', async () => {
    const { createRoot } = await import('react-dom/client')
    // Dynamically import main.tsx to execute it
    await import('./main.tsx')
    const { default: MockedApp } = await import('./App')

    // Check if createRoot was called with the #root element
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'))

    // Check if render was called with the App component inside StrictMode
    const renderedTree = mockRender.mock.calls[0][0]
    expect(renderedTree.type).toBe(StrictMode)
    expect(renderedTree.props.children.type).toBe(MockedApp)
  })
})
