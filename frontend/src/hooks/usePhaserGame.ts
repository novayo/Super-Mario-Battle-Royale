import React, { useEffect } from 'react'
import Phaser from 'phaser'
import { ASSETS } from '../game/constants/assets'

export const usePhaserGame = (
  gameContainer: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    if (!gameContainer.current) {
      return
    }

    class GameScene extends Phaser.Scene {
      private player?: Phaser.Physics.Arcade.Sprite

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
        const groundTexture = this.textures.get(
          ASSETS.IMAGES.OBJECTS.BRICK1.key,
        )
        const groundWidth = groundTexture.getSourceImage().width
        if (groundWidth <= 0) {
          return
        }

        for (let x = 0; x <= 800; x += groundWidth) {
          platforms
            .create(x, 580, ASSETS.IMAGES.OBJECTS.BRICK1.key)
            .setOrigin(0, 0)
            .refreshBody()
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
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameContainer.current,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 300 },
          debug: false,
        },
      },
      scene: [GameScene],
    }

    const game = new Phaser.Game(config)

    // Cleanup function to destroy the game instance when the component unmounts
    return () => {
      game.destroy(true)
    }
  }, [gameContainer])
}
