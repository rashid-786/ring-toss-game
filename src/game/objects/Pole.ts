import Phaser from 'phaser';
import { GAME_WIDTH, ZONE_HEIGHT } from '../../config/gameConfig';
import type { PoleConfig } from '../../types/game';

/**
 * A scoring pole. The visible shaft is decorative; the actual landing target is
 * an invisible physics body (the "zone") at the top of the pole. The pole
 * patrols horizontally between minX and maxX.
 */
export class Pole {
  readonly config: PoleConfig;

  /** Invisible physics body used as the landing zone. */
  readonly zone: Phaser.Physics.Arcade.Image;

  private shaft: Phaser.GameObjects.Image;

  private label: Phaser.GameObjects.Text;

  private minX: number;

  private maxX: number;

  private speed: number;

  private dir: 1 | -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundTop: number,
    config: PoleConfig,
    patrolAmplitude: number,
    speedOverride?: number,
  ) {
    this.config = config;
    this.speed = Math.abs(speedOverride ?? config.speed);
    this.dir = this.speed === 0 ? 1 : 1;

    const zoneY = groundTop - config.height - ZONE_HEIGHT / 2;

    this.zone = scene.physics.add.image(x, zoneY, 'pixel').setVisible(false);
    this.zone.setDepth(4);

    const zoneBody = this.zone.body as Phaser.Physics.Arcade.Body;
    zoneBody.setSize(config.landingZoneWidth, ZONE_HEIGHT, true);
    zoneBody.setAllowGravity(false);
    zoneBody.setVelocityX(this.dir * this.speed);

    this.shaft = scene.add.image(x, groundTop - config.height / 2, 'pole');
    this.shaft.setDisplaySize(config.width, config.height);
    this.shaft.setTint(config.color);
    this.shaft.setDepth(1);

    this.label = scene.add.text(x, zoneY - ZONE_HEIGHT / 2 - 14, config.label, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.label.setOrigin(0.5);
    this.label.setStroke('#000000', 4);
    this.label.setDepth(3);

    const halfWidth = config.landingZoneWidth / 2;
    this.minX = Math.max(halfWidth, x - patrolAmplitude);
    this.maxX = Math.min(GAME_WIDTH - halfWidth, x + patrolAmplitude);
  }

  update(): void {
    const body = this.zone.body as Phaser.Physics.Arcade.Body;
    if (this.zone.x <= this.minX) {
      this.dir = 1;
      body.setVelocityX(this.speed);
    } else if (this.zone.x >= this.maxX) {
      this.dir = -1;
      body.setVelocityX(-this.speed);
    }
    this.shaft.x = this.zone.x;
    this.label.x = this.zone.x;
  }

  destroy(): void {
    this.zone.destroy();
    this.shaft.destroy();
    this.label.destroy();
  }
}