import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// Mock Lobby to avoid verifying its internal flow here
vi.mock('./components/Lobby', () => ({
  Lobby: () => <div data-testid="lobby">Lobby</div>,
}))

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('lobby')).toBeDefined()
  })
})
