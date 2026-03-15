// src/game/PhaserGame.ts

import Phaser from 'phaser'
import { ASSETS } from './constants/assets'
import NetworkService from './NetworkService'

const NETWORK_TICK_MS = 50 // 20Hz

// This is a placeholder for a Phaser Scene.
class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private playerId: string = crypto.randomUUID()
  private otherPlayers: Map<string, Phaser.Physics.Arcade.Sprite> = new Map()
  private network = NetworkService.getInstance()
  private unsubscribeGameState: (() => void) | null = null
  private lastNetworkSend: number = 0

  constructor() {
    super('GameScene')
  }

  preload() {
    // Load Player Assets
    this.load.image(
      ASSETS.IMAGES.CHARACTERS.MARIO.key,
      ASSETS.IMAGES.CHARACTERS.MARIO.path,
    )
    this.load.image(
      ASSETS.IMAGES.CHARACTERS.MARIO_JUMP.key,
      ASSETS.IMAGES.CHARACTERS.MARIO_JUMP.path,
    )

    // Load Object Assets
    this.load.image(
      ASSETS.IMAGES.OBJECTS.BRICK1.key,
      ASSETS.IMAGES.OBJECTS.BRICK1.path,
    )

    // Load Audio Assets
    this.load.audio(
      ASSETS.AUDIO.BGM.OVERWORLD.key,
      ASSETS.AUDIO.BGM.OVERWORLD.path,
    )
  }

  create() {
    // Play Background Music
    this.sound.play(ASSETS.AUDIO.BGM.OVERWORLD.key, { loop: true })

    // Create Platforms
    const platforms = this.physics.add.staticGroup()
    const groundTexture = this.textures.get(ASSETS.IMAGES.OBJECTS.BRICK1.key)
    const groundWidth = groundTexture.getSourceImage().width

    if (groundWidth > 0) {
      for (let x = 0; x <= 800; x += groundWidth) {
        platforms
          .create(x, 580, ASSETS.IMAGES.OBJECTS.BRICK1.key)
          .setOrigin(0, 0)
          .refreshBody()
      }
    }

    // Create Player
    this.player = this.physics.add.sprite(
      400,
      100,
      ASSETS.IMAGES.CHARACTERS.MARIO.key,
    )

    // Player Physics properties
    this.player.setBounce(0.2)
    this.player.setCollideWorldBounds(true)

    // Add collision between player and platforms
    this.physics.add.collider(this.player, platforms)

    // Set up keyboard listeners
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
    }

    // Register the game-state callback BEFORE initializing network
    this.unsubscribeGameState = this.network.onGameState((state) => {
      this.updateOtherPlayers(state.players || [])
    })

    // Initialize Network connection
    this.network.init().catch((err) => {
      console.warn('Networking unavailable:', err)
    })

    // Visibility event listeners
    this.game.events.on('hidden', () => {
      console.log('Game HIDDEN')
    })
    this.game.events.on('visible', () => {
      console.log('Game VISIBLE')
    })
    this.game.events.on('blur', () => {
      console.log('Game BLUR')
    })
    this.game.events.on('focus', () => {
      console.log('Game FOCUS')
    })
  }

  /**
   * Updates or creates sprites for other players in the game.
   */
  private updateOtherPlayers(players: any[]) {
    const updatedIds = new Set(players.map((p) => p.playerId))

    players.forEach((p) => {
      if (p.playerId === this.playerId) return

      let remotePlayer = this.otherPlayers.get(p.playerId)
      if (!remotePlayer) {
        remotePlayer = this.physics.add.sprite(
          p.x,
          p.y,
          ASSETS.IMAGES.CHARACTERS.MARIO.key,
        )
        // Make other players semi-transparent to differentiate them
        remotePlayer.setAlpha(0.6)
        // Disable gravity for remote players since they are positioned explicitly by the server
        if (remotePlayer.body) {
          ;(remotePlayer.body as Phaser.Physics.Arcade.Body).allowGravity =
            false
        }
        this.otherPlayers.set(p.playerId, remotePlayer)
      }

      remotePlayer.setPosition(p.x, p.y)
      remotePlayer.setFlipX(p.flipX)
    })

    // Remove players that are no longer in the game state
    for (const [playerId, sprite] of this.otherPlayers.entries()) {
      if (!updatedIds.has(playerId)) {
        sprite.destroy()
        this.otherPlayers.delete(playerId)
        console.info(`Removed sprite for player ${playerId}`)
      }
    }
  }

  update() {
    if (!this.cursors || !this.player) return

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160)
      this.player.setFlipX(true)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160)
      this.player.setFlipX(false)
    } else {
      this.player.setVelocityX(0)
    }

    if (
      (this.cursors.up.isDown || this.cursors.space.isDown) &&
      this.player.body?.touching.down
    ) {
      this.player.setVelocityY(-330)
    }

    // Send position update to server (throttled)
    const now = Date.now()
    if (now - this.lastNetworkSend >= NETWORK_TICK_MS) {
      this.network.sendUpdate({
        x: this.player.x,
        y: this.player.y,
        flipX: this.player.flipX,
        animation: 'idle',
      })
      this.lastNetworkSend = now
    }
  }

  shutdown() {
    console.log('GameScene shutting down')
    if (this.unsubscribeGameState) {
      this.unsubscribeGameState()
      this.unsubscribeGameState = null
    }
    this.network.dispose()
  }
}

// This is a placeholder for the main Phaser Game instance.
export const createGame = (container: HTMLElement) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: container,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 300 },
        debug: false,
      },
    },
    scene: [GameScene],
  }

  return new Phaser.Game(config)
}
