import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export const GameCanvas: React.FC = () => {
  const gameContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameContainer.current) {
      return;
    }

    class BootScene extends Phaser.Scene {
      constructor() {
        super('BootScene');
      }

      create() {
        this.add
          .text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'Phaser Engine Ready!',
            {
              font: '32px Arial',
              color: '#ffffff',
            }
          )
          .setOrigin(0.5);
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
          debug: true,
        },
      },
      scene: [BootScene],
    };

    const game = new Phaser.Game(config);

    // Cleanup function to destroy the game instance when the component unmounts
    return () => {
      game.destroy(true);
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount and cleanup on unmount.

  return <div ref={gameContainer} />;
};
