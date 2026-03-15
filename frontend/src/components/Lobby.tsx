import React, { useState } from 'react'
import { LandingPage } from './Lobby/LandingPage'
import { Dashboard } from './Lobby/Dashboard'
import { GameCanvas } from './GameCanvas'

export const Lobby: React.FC = () => {
  const [nickname, setNickname] = useState('')
  const [joinedRoom, setJoinedRoom] = useState(false)
  const [roomName, setRoomName] = useState('')

  const handleNicknameSet = (name: string) => {
    setNickname(name)
  }

  const handleJoinRoom = (name: string) => {
    setRoomName(name)
    setJoinedRoom(true)
  }

  const handleJoinRandom = () => {
    setRoomName('Random Room')
    setJoinedRoom(true)
  }

  if (joinedRoom) {
    // Pass props to GameCanvas for future integration
    return <GameCanvas />
  }

  if (!nickname) {
    return <LandingPage onNicknameSet={handleNicknameSet} />
  }

  return (
    <Dashboard
      nickname={nickname}
      onJoinRoom={handleJoinRoom}
      onJoinRandom={handleJoinRandom}
    />
  )
}
