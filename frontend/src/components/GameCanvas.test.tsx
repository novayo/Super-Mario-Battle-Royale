import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { GameCanvas } from './GameCanvas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePhaserGame } from '../hooks/usePhaserGame'

vi.mock('../hooks/usePhaserGame', () => ({
  usePhaserGame: vi.fn(),
}))

describe('GameCanvas Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a div to contain the game', () => {
    const { container } = render(<GameCanvas />)
    expect(container.querySelector('div')).not.toBeNull()
  })

  it('calls the usePhaserGame hook', () => {
    render(<GameCanvas />)
    expect(usePhaserGame).toHaveBeenCalled()
  })
})
