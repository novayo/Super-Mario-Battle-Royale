import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas"></div>,
}))

describe('App Component', () => {
  it('renders the main application page', () => {
    render(<App />)

    // Check for the main heading
    expect(screen.getByText('Super Mario Battle Royale')).toBeDefined()

    // Check if the mocked GameCanvas is rendered
    expect(screen.getByTestId('game-canvas')).toBeDefined()
  })
})
