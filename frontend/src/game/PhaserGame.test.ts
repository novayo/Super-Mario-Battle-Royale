// src/game/PhaserGame.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGame } from './PhaserGame'

const { mockGame, mockAddText } = vi.hoisted(() => {
  return {
    mockGame: vi.fn(),
    mockAddText: vi.fn(),
  }
})

vi.mock('phaser', () => {
  class MockScene {
    add: any
    constructor() {
      this.add = { text: mockAddText }
    }
    preload() {}
    create() {}
    update() {}
  }

  return {
    default: {
      Game: mockGame,
      Scene: MockScene,
      AUTO: 'AUTO',
    },
  }
})

describe('PhaserGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should create a game and scene with correct configurations', () => {
    const canvas = document.createElement('canvas')
    createGame(canvas)

    // Test createGame config
    expect(mockGame).toHaveBeenCalled()
    const config = mockGame.mock.calls[0][0]
    expect(config.type).toBe('AUTO')
    expect(config.width).toBe(800)
    expect(config.height).toBe(600)
    expect(config.canvas).toBe(canvas)
    expect(config.scene).toBeInstanceOf(Array)
    expect(config.scene.length).toBe(1)

    // Test GameScene
    const SceneClass = config.scene[0]
    const sceneInstance = new SceneClass()

    sceneInstance.preload() // for coverage
    sceneInstance.create()
    sceneInstance.update() // for coverage

    expect(mockAddText).toHaveBeenCalledWith(
      10,
      10,
      'Phaser Game placeholder',
      {
        font: '16px Courier',
        color: '#ffffff',
      },
    )
  })
})
