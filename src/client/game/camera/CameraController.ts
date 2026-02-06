import Phaser from 'phaser';
import { CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN, CAMERA_ZOOM_STEP } from '@shared/Constants';

export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private readonly spaceKey: Phaser.Input.Keyboard.Key;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  private readonly panSpeedPxPerSecond = 420;

  constructor(scene: Phaser.Scene, mapWidthPx: number, mapHeightPx: number) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    if (!scene.input.keyboard) {
      throw new Error('Keyboard input is unavailable');
    }

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      w: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.camera.setBounds(0, 0, mapWidthPx, mapHeightPx);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('wheel', this.onWheel, this);

    scene.input.mouse?.disableContextMenu();
  }

  update(deltaMs: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.a.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.d.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.w.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.s.isDown) dy += 1;

    if (dx === 0 && dy === 0) {
      return;
    }

    const speed = (this.panSpeedPxPerSecond * deltaMs) / 1000;
    this.camera.scrollX += (dx * speed) / this.camera.zoom;
    this.camera.scrollY += (dy * speed) / this.camera.zoom;
  }

  isPanModifierPressed(): boolean {
    return this.spaceKey.isDown;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('wheel', this.onWheel, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const canPanWithLeft = pointer.leftButtonDown() && this.spaceKey.isDown;
    const canPanWithAltButton = pointer.middleButtonDown() || pointer.rightButtonDown();

    if (!canPanWithLeft && !canPanWithAltButton) {
      return;
    }

    this.isDragging = true;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.cameraStartX = this.camera.scrollX;
    this.cameraStartY = this.camera.scrollY;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) {
      return;
    }

    const dx = this.dragStartX - pointer.x;
    const dy = this.dragStartY - pointer.y;

    this.camera.scrollX = this.cameraStartX + dx / this.camera.zoom;
    this.camera.scrollY = this.cameraStartY + dy / this.camera.zoom;
  }

  private onPointerUp(): void {
    this.isDragging = false;
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const change = deltaY > 0 ? -CAMERA_ZOOM_STEP : CAMERA_ZOOM_STEP;
    const zoom = Phaser.Math.Clamp(this.camera.zoom + change, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);

    const worldBefore = this.camera.getWorldPoint(pointer.x, pointer.y);
    this.camera.setZoom(zoom);
    const worldAfter = this.camera.getWorldPoint(pointer.x, pointer.y);

    this.camera.scrollX += worldBefore.x - worldAfter.x;
    this.camera.scrollY += worldBefore.y - worldAfter.y;
  }
}
