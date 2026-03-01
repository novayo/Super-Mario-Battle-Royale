import React, { useRef } from 'react'
import { usePhaserGame } from '../hooks/usePhaserGame'

export const GameCanvas: React.FC = () => {
  const gameContainer = useRef<HTMLDivElement>(null)
  usePhaserGame(gameContainer)

  return <div ref={gameContainer} />
}
