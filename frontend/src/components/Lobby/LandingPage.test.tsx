import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('renders standard elements', () => {
    render(<LandingPage onNicknameSet={() => {}} />)
    expect(screen.getByText('Super Mario Battle Royale')).toBeDefined()
    expect(screen.getByPlaceholderText('e.g. MarioMaster')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined()
  })

  it('calls onNicknameSet with valid nickname', () => {
    const handleNicknameSet = vi.fn()
    render(<LandingPage onNicknameSet={handleNicknameSet} />)

    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'TestUser' } })

    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button)

    expect(handleNicknameSet).toHaveBeenCalledWith('TestUser')
  })

  it('shows error message on empty nickname', () => {
    render(<LandingPage onNicknameSet={() => {}} />)

    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button)

    expect(screen.getByText('Nickname cannot be empty')).toBeDefined()
  })

  it('shows error message on too long nickname', () => {
    render(<LandingPage onNicknameSet={() => {}} />)

    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'A'.repeat(16) } })

    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button)

    expect(
      screen.getByText('Nickname must be 15 characters or less'),
    ).toBeDefined()
  })
  it('clears error message when user types', () => {
    render(<LandingPage onNicknameSet={() => {}} />)

    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button) // Trigger error

    expect(screen.getByText('Nickname cannot be empty')).toBeDefined()

    const input = screen.getByPlaceholderText('e.g. MarioMaster')
    fireEvent.change(input, { target: { value: 'a' } })

    expect(screen.queryByText('Nickname cannot be empty')).toBeNull()
  })
})
