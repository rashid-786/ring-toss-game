import Phaser from 'phaser';
import { RING_RADIUS } from '../../config/gameConfig';

export class Ring extends Phaser.Physics.Arcade.Sprite {
  readonly homeX: number;

  readonly homeY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    super(scene, x, y, 'ring');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.homeX = x;
    this.homeY = y;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(RING_RADIUS);
    body.setBounce(0.25);
    body.setFriction(0.9);
    body.setCollideWorldBounds(false);
    body.setEnable(false);

    this.setDepth(10);
    this.setTint(color);
  }

  setPlayerColor(color: number): void {
    this.setTint(color);
  }

  /** Disables physics and returns the ring to its home position. */
  resetHome(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(false);
    body.setVelocity(0, 0);
    this.setPosition(this.homeX, this.homeY);
    this.setRotation(0);
    this.setAlpha(1);
  }

  launch(vx: number, vy: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.reset(this.homeX, this.homeY);
    this.setAlpha(1);
    this.setRotation(0);
    body.setVelocity(vx, vy);
  }

  /** Returns the arcade body (always dynamic for the ring). */
  getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }
}