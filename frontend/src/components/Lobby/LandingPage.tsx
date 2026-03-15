import React, { useState } from 'react'
import './LandingPage.css'

interface LandingPageProps {
  onNicknameSet: (nickname: string) => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNicknameSet }) => {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Nickname cannot be empty')
      return
    }
    if (nickname.length > 15) {
      setError('Nickname must be 15 characters or less')
      return
    }
    onNicknameSet(nickname.trim())
  }

  return (
    <div className="landing-page">
      <div className="glass-panel">
        <h1>Super Mario Battle Royale</h1>
        <p className="subtitle">Enter your nickname to join the battle</p>

        <form onSubmit={handleSubmit} className="nickname-form">
          <div className="input-group">
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                if (error) setError('')
              }}
              placeholder="e.g. MarioMaster"
              maxLength={15}
              autoFocus
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="neon-button">
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
