import { renderHook } from '@testing-library/react'
import { usePhaserGame } from './usePhaserGame'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mocks should be defined outside the test suite
const mockDestroy = vi.fn()
const mockPlay = vi.fn()
const mockSetOrigin = vi.fn(() => ({ refreshBody: vi.fn() }))
const mockCreate = vi.fn(() => ({ setOrigin: mockSetOrigin }))
const mockStaticGroup = vi.fn(() => ({ create: mockCreate }))
const mockSetBounce = vi.fn()
const mockSetCollideWorldBounds = vi.fn()
const mockPlayerSprite = {
  setBounce: mockSetBounce,
  setCollideWorldBounds: mockSetCollideWorldBounds,
}
const mockPhysicsAddSprite = vi.fn(() => mockPlayerSprite)
const mockCollider = vi.fn()

const mockGame = vi.fn(() => ({
  destroy: mockDestroy,
  sound: { play: mockPlay },
  textures: { get: vi.fn(() => ({ getSourceImage: () => ({ width: 32 }) })) },
  physics: {
    add: {
      staticGroup: mockStaticGroup,
      sprite: mockPhysicsAddSprite,
      collider: mockCollider,
    },
  },
}))

vi.mock('phaser', () => {
  class MockScene {
    load: any
    sound: any
    physics: any
    textures: any
    constructor() {
      this.load = { image: vi.fn(), audio: vi.fn() }
      this.sound = { play: mockPlay }
      this.physics = {
        add: {
          staticGroup: mockStaticGroup,
          sprite: mockPhysicsAddSprite,
          collider: mockCollider,
        },
      }
      this.textures = {
        get: vi.fn(() => ({ getSourceImage: () => ({ width: 32 }) })),
      }
    }
    preload() {}
    create() {}
  }

  return {
    default: {
      get Game() {
        return mockGame
      },
      Scene: MockScene,
      AUTO: 'AUTO',
      Types: { Core: { GameConfig: {} } },
    },
  }
})

describe('usePhaserGame Hook', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not initialize Phaser if the container is not available', () => {
    const gameContainer = { current: null }
    renderHook(() => usePhaserGame(gameContainer))
    expect(mockGame).not.toHaveBeenCalled()
  })

  it('initializes a Phaser.Game instance on mount', () => {
    const gameContainer = { current: document.createElement('div') }
    renderHook(() => usePhaserGame(gameContainer))
    expect(mockGame).toHaveBeenCalledTimes(1)
  })

  it("calls the game's destroy method on unmount", () => {
    const gameContainer = { current: document.createElement('div') }
    const { unmount } = renderHook(() => usePhaserGame(gameContainer))
    unmount()
    expect(mockDestroy).toHaveBeenCalledWith(true)
  })

  it('creates a scene that loads assets and creates game objects', () => {
    const gameContainer = { current: document.createElement('div') }
    renderHook(() => usePhaserGame(gameContainer))

    const sceneConstructor = mockGame.mock.calls[0][0].scene[0]
    const sceneInstance = new sceneConstructor()

    // Simulate Phaser's lifecycle
    sceneInstance.preload()
    sceneInstance.create()

    // Check asset loading
    expect(sceneInstance.load.image).toHaveBeenCalledWith(
      'mario',
      expect.any(String),
    )
    expect(sceneInstance.load.image).toHaveBeenCalledWith(
      'mario_jump',
      expect.any(String),
    )
    expect(sceneInstance.load.image).toHaveBeenCalledWith(
      'brick1',
      expect.any(String),
    )
    expect(sceneInstance.load.audio).toHaveBeenCalledWith(
      'overworld',
      expect.any(String),
    )

    // Check object creation
    expect(sceneInstance.sound.play).toHaveBeenCalledWith('overworld', {
      loop: true,
    })
    expect(mockStaticGroup).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
    expect(mockPhysicsAddSprite).toHaveBeenCalledWith(400, 100, 'mario')
    expect(mockSetBounce).toHaveBeenCalledWith(0.2)
    expect(mockSetCollideWorldBounds).toHaveBeenCalledWith(true)
    expect(mockCollider).toHaveBeenCalled()
  })

  it('does not create platforms if ground texture width is zero', () => {
    const gameContainer = { current: document.createElement('div') }
    renderHook(() => usePhaserGame(gameContainer))

    const sceneConstructor = mockGame.mock.calls[0][0].scene[0]
    const sceneInstance = new sceneConstructor()

    // Override the texture mock for this specific test
    sceneInstance.textures.get.mockReturnValue({
      getSourceImage: () => ({ width: 0 }),
    })

    sceneInstance.create()

    expect(mockCreate).not.toHaveBeenCalled()
  })
})
