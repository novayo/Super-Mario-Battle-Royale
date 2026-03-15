import React, { useState } from 'react'
import './Dashboard.css'

interface DashboardProps {
  nickname: string
  onJoinRoom: (roomName: string) => void
  onJoinRandom: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  nickname,
  onJoinRoom,
  onJoinRandom,
}) => {
  const [roomName, setRoomName] = useState('')
  const [error, setError] = useState('')

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim()) {
      setError('Room name cannot be empty')
      return
    }
    if (roomName.length > 20) {
      setError('Room name must be 20 characters or less')
      return
    }
    onJoinRoom(roomName.trim())
  }

  return (
    <div className="dashboard">
      <div className="glass-panel wide">
        <header className="dashboard-header">
          <h1>Welcome, {nickname}!</h1>
          <p className="subtitle">Choose how you want to play</p>
        </header>

        <div className="dashboard-grid">
          <section className="dashboard-section">
            <h2>Create a Room</h2>
            <form onSubmit={handleCreateRoom} className="room-form">
              <div className="input-group">
                <input
                  type="text"
                  id="roomName"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value)
                    if (error) setError('')
                  }}
                  placeholder="Enter room name..."
                  maxLength={20}
                />
                {error && <span className="error-message">{error}</span>}
              </div>
              <button type="submit" className="neon-button secondary">
                Create & Join
              </button>
            </form>
          </section>

          <div className="divider">
            <span>OR</span>
          </div>

          <section className="dashboard-section centered">
            <h2>Quick Play</h2>
            <p className="section-desc">Jump into a random available room</p>
            <button onClick={onJoinRandom} className="neon-button primary">
              Join Random Room
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
