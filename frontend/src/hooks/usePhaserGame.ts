import React, { useEffect } from 'react'
import { createGame } from '../game/PhaserGame'

export const usePhaserGame = (
  gameContainer: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    if (!gameContainer.current) {
      return
    }

    const game = createGame(gameContainer.current)

    // Cleanup function to destroy the game instance when the component unmounts
    return () => {
      game.destroy(true)
    }
  }, [gameContainer])
}
