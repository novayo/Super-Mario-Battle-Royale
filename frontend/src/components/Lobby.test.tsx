import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Lobby } from './Lobby'

// Mock GameCanvas to avoid initializing Phaser in tests
vi.mock('./GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas">Game Canvas</div>,
}))

describe('Lobby', () => {
  it('renders LandingPage initially', () => {
    render(<Lobby />)
    expect(screen.getByText('Super Mario Battle Royale')).toBeDefined()
    expect(screen.queryByText('Welcome')).toBeNull()
  })

  it('transitions to Dashboard after nickname is set', () => {
    render(<Lobby />)

    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'TestUser' } })

    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button)

    expect(screen.getByText('Welcome, TestUser!')).toBeDefined()
    expect(screen.queryByText('Super Mario Battle Royale')).toBeNull()
  })

  it('transitions to GameCanvas after joining a room', () => {
    render(<Lobby />)

    // Set nickname
    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'TestUser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Join room
    const roomInput = screen.getByPlaceholderText('Enter room name...')
    fireEvent.change(roomInput, { target: { value: 'MyRoom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create & Join' }))

    expect(screen.getByTestId('game-canvas')).toBeDefined()
    expect(screen.queryByText('Welcome, TestUser!')).toBeNull()
  })

  it('transitions to GameCanvas after joining random room', () => {
    render(<Lobby />)

    // Set nickname
    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'TestUser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Join random
    fireEvent.click(screen.getByRole('button', { name: 'Join Random Room' }))

    expect(screen.getByTestId('game-canvas')).toBeDefined()
  })
})
