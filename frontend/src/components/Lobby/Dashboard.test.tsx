import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  const nickname = 'TestUser'

  it('renders standard elements', () => {
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={() => {}}
        onJoinRandom={() => {}}
      />,
    )
    expect(screen.getByText(`Welcome, ${nickname}!`)).toBeDefined()
    expect(screen.getByPlaceholderText('Enter room name...')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create & Join' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Join Random Room' }),
    ).toBeDefined()
  })

  it('calls onJoinRoom with valid room name', () => {
    const handleJoinRoom = vi.fn()
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={handleJoinRoom}
        onJoinRandom={() => {}}
      />,
    )

    const input = screen.getByPlaceholderText('Enter room name...')
    fireEvent.change(input, { target: { value: 'MyRoom' } })

    const button = screen.getByRole('button', { name: 'Create & Join' })
    fireEvent.click(button)

    expect(handleJoinRoom).toHaveBeenCalledWith('MyRoom')
  })

  it('shows error message on empty room name', () => {
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={() => {}}
        onJoinRandom={() => {}}
      />,
    )

    const button = screen.getByRole('button', { name: 'Create & Join' })
    fireEvent.click(button)

    expect(screen.getByText('Room name cannot be empty')).toBeDefined()
  })

  it('shows error message on too long room name', () => {
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={() => {}}
        onJoinRandom={() => {}}
      />,
    )

    const input = screen.getByPlaceholderText('Enter room name...')
    fireEvent.change(input, { target: { value: 'A'.repeat(21) } })

    const button = screen.getByRole('button', { name: 'Create & Join' })
    fireEvent.click(button)

    expect(
      screen.getByText('Room name must be 20 characters or less'),
    ).toBeDefined()
  })

  it('calls onJoinRandom on button click', () => {
    const handleJoinRandom = vi.fn()
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={() => {}}
        onJoinRandom={handleJoinRandom}
      />,
    )

    const button = screen.getByRole('button', { name: 'Join Random Room' })
    fireEvent.click(button)

    expect(handleJoinRandom).toHaveBeenCalled()
  })

  it('clears error message when user types', () => {
    render(
      <Dashboard
        nickname={nickname}
        onJoinRoom={() => {}}
        onJoinRandom={() => {}}
      />,
    )

    const button = screen.getByRole('button', { name: 'Create & Join' })
    fireEvent.click(button) // Trigger error

    expect(screen.getByText('Room name cannot be empty')).toBeDefined()

    const input = screen.getByPlaceholderText('Enter room name...')
    fireEvent.change(input, { target: { value: 'a' } })

    expect(screen.queryByText('Room name cannot be empty')).toBeNull()
  })
})
