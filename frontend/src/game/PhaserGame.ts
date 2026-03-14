// src/game/PhaserGame.ts

import Phaser from 'phaser'
import { ASSETS } from './constants/assets'

// This is a placeholder for a Phaser Scene.
class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys

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
