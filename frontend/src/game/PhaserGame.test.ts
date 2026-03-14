// src/game/PhaserGame.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGame } from './PhaserGame'
import { ASSETS } from './constants/assets'

const {
  mockGame,
  mockAddText,
  mockAddSprite,
  mockCreateCursorKeys,
  mockLoadImage,
  mockSoundPlay,
  mockPhysicsAddStaticGroup,
  mockPhysicsAddCollider,
  mockLoadAudio,
} = vi.hoisted(() => {
  return {
    mockGame: vi.fn(),
    mockAddText: vi.fn(),
    mockAddSprite: vi.fn().mockReturnValue({
      setBounce: vi.fn().mockReturnThis(),
      setCollideWorldBounds: vi.fn().mockReturnThis(),
      setVelocityX: vi.fn().mockReturnThis(),
      setVelocityY: vi.fn().mockReturnThis(),
      setFlipX: vi.fn().mockReturnThis(),
      body: { touching: { down: true } },
    }),
    mockCreateCursorKeys: vi.fn().mockReturnValue({
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
      space: { isDown: false },
      shift: { isDown: false },
    }),
    mockLoadImage: vi.fn(),
    mockSoundPlay: vi.fn(),
    mockPhysicsAddStaticGroup: vi.fn().mockReturnValue({
      create: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      refreshBody: vi.fn().mockReturnThis(),
    }),
    mockPhysicsAddCollider: vi.fn(),
    mockLoadAudio: vi.fn(),
  }
})

vi.mock('phaser', () => {
  class MockScene {
    add: any
    input: any
    load: any
    sound: any
    physics: any
    textures: any
    constructor() {
      this.add = {
        text: mockAddText,
        sprite: mockAddSprite,
      }
      this.input = {
        keyboard: {
          createCursorKeys: mockCreateCursorKeys,
        },
      }
      this.load = {
        image: mockLoadImage,
        audio: mockLoadAudio,
      }
      this.sound = {
        play: mockSoundPlay,
      }
      this.physics = {
        add: {
          staticGroup: mockPhysicsAddStaticGroup,
          sprite: mockAddSprite,
          collider: mockPhysicsAddCollider,
        },
      }
      this.textures = {
        get: vi.fn().mockReturnValue({
          getSourceImage: vi.fn().mockReturnValue({ width: 32 }),
        }),
      }
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
    const container = document.createElement('div')
    createGame(container)

    // Test createGame config
    expect(mockGame).toHaveBeenCalled()
    const config = mockGame.mock.calls[0][0]
    expect(config.type).toBe('AUTO')
    expect(config.width).toBe(800)
    expect(config.height).toBe(600)
    expect(config.parent).toBe(container)
    expect(config.scene).toBeInstanceOf(Array)
    expect(config.scene.length).toBe(1)

    // Test GameScene
    const SceneClass = config.scene[0]
    const sceneInstance = new SceneClass()

    sceneInstance.preload() // for coverage
    sceneInstance.create()
    sceneInstance.update() // for coverage

    expect(mockLoadImage).toHaveBeenCalledWith(
      ASSETS.IMAGES.CHARACTERS.MARIO.key,
      ASSETS.IMAGES.CHARACTERS.MARIO.path,
    )

    expect(mockSoundPlay).toHaveBeenCalledWith(ASSETS.AUDIO.BGM.OVERWORLD.key, {
      loop: true,
    })

    expect(mockPhysicsAddStaticGroup).toHaveBeenCalled()
    expect(mockAddSprite).toHaveBeenCalledWith(
      400,
      100,
      ASSETS.IMAGES.CHARACTERS.MARIO.key,
    )
    expect(mockLoadAudio).toHaveBeenCalledWith(
      ASSETS.AUDIO.BGM.OVERWORLD.key,
      ASSETS.AUDIO.BGM.OVERWORLD.path,
    )
    expect(mockCreateCursorKeys).toHaveBeenCalled()
  })

  it('should flip sprite correctly based on movement direction', () => {
    const container = document.createElement('div')
    createGame(container)

    const config = mockGame.mock.calls[0][0]
    const SceneClass = config.scene[0]
    const sceneInstance = new SceneClass()

    sceneInstance.create()
    const cursors = mockCreateCursorKeys.mock.results[0].value

    // Mock left key down
    cursors.left.isDown = true
    cursors.right.isDown = false
    sceneInstance.update()
    const playerMock = mockAddSprite.mock.results[0].value
    expect(playerMock.setFlipX).toHaveBeenCalledWith(true)

    // Mock right key down
    cursors.left.isDown = false
    cursors.right.isDown = true
    sceneInstance.update()
    expect(playerMock.setFlipX).toHaveBeenCalledWith(false)
  })

  it('should jump when up or space is pressed and player is touching down', () => {
    const container = document.createElement('div')
    createGame(container)

    const config = mockGame.mock.calls[0][0]
    const SceneClass = config.scene[0]
    const sceneInstance = new SceneClass()

    sceneInstance.create()
    const cursors = mockCreateCursorKeys.mock.results[0].value
    const playerMock = mockAddSprite.mock.results[0].value

    // Mock up key down and touching down
    cursors.up.isDown = true
    playerMock.body.touching.down = true
    sceneInstance.update()
    expect(playerMock.setVelocityY).toHaveBeenCalledWith(-330)

    // Reset mocks and test space key
    vi.clearAllMocks()
    cursors.up.isDown = false
    cursors.space.isDown = true
    playerMock.body.touching.down = true
    sceneInstance.update()
    expect(playerMock.setVelocityY).toHaveBeenCalledWith(-330)
  })

  it('should early return in update if cursors or player are missing', () => {
    const container = document.createElement('div')
    createGame(container)

    const config = mockGame.mock.calls[0][0]
    const SceneClass = config.scene[0]
    const sceneInstance = new SceneClass()

    // Test with missing cursors (not calling create or manually setting)
    sceneInstance.update() // cursors and player are undefined initially

    // Test with missing player specifically
    sceneInstance.create()
    sceneInstance.player = undefined
    sceneInstance.update()
  })
})
