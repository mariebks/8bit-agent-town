import Phaser from 'phaser';
import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from '@shared/Constants';
import { BootScene } from './game/scenes/BootScene';
import { TownScene } from './game/scenes/TownScene';

const fallbackWidthPx = MAP_WIDTH_TILES * TILE_SIZE;
const fallbackHeightPx = MAP_HEIGHT_TILES * TILE_SIZE;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: fallbackWidthPx,
  height: fallbackHeightPx,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, TownScene],
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

declare global {
  interface Window {
    __agentTownGame?: Phaser.Game;
  }
}

if (typeof window !== 'undefined') {
  window.__agentTownGame = game;
}
