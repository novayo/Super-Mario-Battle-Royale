import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Lobby } from './Lobby'

describe('Lobby Component', () => {
  it('renders the lobby with a welcome message', () => {
    render(<Lobby />)

    // Check for the heading
    expect(screen.getByText('Game Lobby')).toBeDefined()

    // Check for the descriptive paragraph
    expect(
      screen.getByText('Players will wait here before the game starts.'),
    ).toBeDefined()
  })
})
