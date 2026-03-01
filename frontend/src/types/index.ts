// src/types/index.ts

/**
 * Example type for a Player
 */
export interface Player {
  id: string
  name: string
  isReady: boolean
}

/**
 * Example type for Game State
 */
export interface GameState {
  players: Player[]
  status: 'waiting' | 'in-progress' | 'finished'
}
