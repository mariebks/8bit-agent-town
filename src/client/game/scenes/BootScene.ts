import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('tileset', 'assets/tiles/tileset.png');
    this.load.tilemapTiledJSON('townmap', 'assets/tiles/town.json');
  }

  create(): void {
    this.scene.start('TownScene');
  }
}
