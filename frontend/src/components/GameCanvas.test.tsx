import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GameCanvas } from './GameCanvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---
const mockDestroy = vi.fn();
const mockPlay = vi.fn();
const mockSetOrigin = vi.fn(() => ({ refreshBody: vi.fn() }));

// Mock chainable create
const mockCreate = vi.fn(() => ({
  setOrigin: mockSetOrigin,
}));

const mockStaticGroup = vi.fn(() => ({
  create: mockCreate,
}));

const mockSetBounce = vi.fn();
const mockSetCollideWorldBounds = vi.fn();
const mockPlayerSprite = {
  setBounce: mockSetBounce,
  setCollideWorldBounds: mockSetCollideWorldBounds,
};
const mockPhysicsAddSprite = vi.fn(() => mockPlayerSprite);
const mockCollider = vi.fn();

const mockGame = vi.fn(() => ({
  destroy: mockDestroy,
  sound: {
    play: mockPlay,
  },
  textures: {
    get: vi.fn(() => ({
      getSourceImage: () => ({ width: 32 }),
    })),
  },
  physics: {
    add: {
      staticGroup: mockStaticGroup,
      sprite: mockPhysicsAddSprite,
      collider: mockCollider,
    },
  },
}));

vi.mock('phaser', () => {
  class MockScene {
    load: any;
    sound: any;
    physics: any;
    textures: any;
    constructor() {
      this.load = { image: vi.fn(), audio: vi.fn() };
      this.sound = { play: mockPlay };
      this.physics = {
        add: {
          staticGroup: mockStaticGroup,
          sprite: mockPhysicsAddSprite,
          collider: mockCollider,
        },
      };
      this.textures = {
        get: vi.fn(() => ({
          getSourceImage: () => ({ width: 32 }),
        })),
      };
    }
    // Phaser lifecycle methods used in the scene
    preload() {}
    create() {}
  }

  return {
    default: {
      get Game() {
        return mockGame;
      },
      Scene: MockScene,
      AUTO: 'AUTO',
      Types: { Core: { GameConfig: {} } },
    },
  };
});

// --- Test Suite ---
describe('GameCanvas Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a div to contain the game', () => {
    const { container } = render(<GameCanvas />);
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('initializes a Phaser.Game instance on mount', () => {
    render(<GameCanvas />);
    expect(mockGame).toHaveBeenCalledTimes(1);
    const config = mockGame.mock.calls[0][0];
    expect(config).toHaveProperty('type', 'AUTO');
    expect(config).toHaveProperty('width', 800);
    expect(config).toHaveProperty('height', 600);
    expect(config).toHaveProperty('scene');
  });

  it('calls the game\'s destroy method on unmount', () => {
    const { unmount } = render(<GameCanvas />);
    expect(mockDestroy).not.toHaveBeenCalled();
    unmount();
    expect(mockDestroy).toHaveBeenCalledWith(true);
  });

  it('creates a scene that loads assets and creates game objects', () => {
    render(<GameCanvas />);

    const sceneConstructor = mockGame.mock.calls[0][0].scene[0];
    const sceneInstance = new sceneConstructor();

    // Simulate Phaser's lifecycle
    sceneInstance.preload();
    sceneInstance.create();

    // Check asset loading
    expect(sceneInstance.load.image).toHaveBeenCalledWith('mario', expect.any(String));
    expect(sceneInstance.load.image).toHaveBeenCalledWith('mario_jump', expect.any(String));
    expect(sceneInstance.load.image).toHaveBeenCalledWith('brick1', expect.any(String));
    expect(sceneInstance.load.audio).toHaveBeenCalledWith('overworld', expect.any(String));

    // Check object creation
    expect(sceneInstance.sound.play).toHaveBeenCalledWith('overworld', { loop: true });
    expect(mockStaticGroup).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPhysicsAddSprite).toHaveBeenCalledWith(400, 100, 'mario');
    expect(mockSetBounce).toHaveBeenCalledWith(0.2);
    expect(mockSetCollideWorldBounds).toHaveBeenCalledWith(true);
    expect(mockCollider).toHaveBeenCalled();
  });
});
