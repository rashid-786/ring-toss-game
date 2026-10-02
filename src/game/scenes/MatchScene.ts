import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
  GRAVITY_Y,
  POLE_CONFIGS,
  POLE_PLACEMENT,
  RING_HOME_X,
  RING_HOME_Y,
  MAX_DRAG,
  MIN_THROW_VELOCITY,
  MAX_THROW_VELOCITY,
  THROW_GRAB_RADIUS,
} from '../../config/gameConfig';
import { createTextures } from '../assets/textures';
import { computeLaunch, simulateTrajectory } from '../physics/ballistics';
import { PLAYER_COLOR_HEX } from '../../utils/constants';
import {
  playCountdownTick,
  playGo,
  playScore,
  playThrow,
  playTurnSwitch,
} from '../../utils/audio';
import type { PoleType } from '../../../shared/types';

export interface MatchSnapshotLike {
  phase: string;
  countdown: number;
  countdownActive: boolean;
  poles: Array<{ index: number; x: number }>;
  ring: { active: boolean; x: number; y: number; rotation: number; playerId: number | null };
  turn: number | null;
}

export interface LandedLike {
  points: number;
  poleType: string;
}

export interface MatchRenderSource {
  getSnapshot(): MatchSnapshotLike | null;
  /** 1 or 2 used to tint the ring / detect turn switches. */
  getTurnColorId(): 1 | 2 | null;
  /** My role as 1/2, or null for spectators. */
  getMyColorId(): 1 | 2 | null;
  canThrow(): boolean;
  launch(vx: number, vy: number): void;
  takeLanded(): LandedLike[];
}

interface PoleVisual {
  type: string;
  shaft: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

/**
 * Reusable renderer. No physics: poles and the ring are interpolated from
 * authoritative server snapshots supplied by a MatchRenderSource. Used by the
 * 2-player online mode.
 */
export class MatchScene extends Phaser.Scene {
  private poleVisuals: PoleVisual[] = [];

  private ringSprite!: Phaser.GameObjects.Image;

  private aimGraphics!: Phaser.GameObjects.Graphics;

  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  private dragging = false;

  private lastCountdown = -1;

  private lastPhase = '';

  private lastTurn: number | null = null;

  private groundTop = GAME_HEIGHT - GROUND_HEIGHT;

  constructor(sceneKey: string, private source: MatchRenderSource) {
    super(sceneKey);
  }

  create(): void {
    createTextures(this);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x7ec8e3).setOrigin(0).setDepth(-10);
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, 'ground')
      .setDisplaySize(GAME_WIDTH, GROUND_HEIGHT)
      .setDepth(-5);

    POLE_PLACEMENT.forEach(({ type, x }) => {
      const cfg = POLE_CONFIGS[type];
      const shaft = this.add.image(x, this.groundTop - cfg.height / 2, 'pole');
      shaft.setDisplaySize(cfg.width, cfg.height);
      shaft.setTint(cfg.color);
      shaft.setDepth(1);

      const label = this.add.text(
        x,
        this.groundTop - cfg.height - 30,
        cfg.label,
        { fontSize: '18px', fontStyle: 'bold', color: '#ffffff' },
      );
      label.setOrigin(0.5);
      label.setStroke('#000000', 4);
      label.setDepth(3);

      this.poleVisuals.push({ type, shaft, label });
    });

    this.ringSprite = this.add.image(RING_HOME_X, RING_HOME_Y, 'ring').setDepth(10).setVisible(false);
    this.aimGraphics = this.add.graphics().setDepth(15);

    this.burst = this.add.particles(0, 0, 'pixel', {
      speed: { min: 60, max: 240 },
      lifespan: 600,
      scale: { start: 0.7, end: 0 },
      quantity: 1,
      emitting: false,
      tint: [0xffffff, 0xffd700, 0xff8a00],
    });
    this.burst.setDepth(20);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
  }

  update(_time: number, delta: number): void {
    const snapshot = this.source.getSnapshot();
    if (!snapshot) return;

    const dt = Math.min(delta, 50);

    this.reconcilePoles(snapshot, dt);
    this.reconcileRing(snapshot, dt);
    this.handleCountdown(snapshot);
    this.handleLanded();
  }

  private reconcilePoles(snapshot: MatchSnapshotLike, dt: number): void {
    const factor = Math.min(1, dt * 0.018);
    snapshot.poles.forEach((p) => {
      const visual = this.poleVisuals[p.index];
      if (!visual) return;
      visual.shaft.x += (p.x - visual.shaft.x) * factor;
      visual.label.x = visual.shaft.x;
    });
  }

  private reconcileRing(snapshot: MatchSnapshotLike, dt: number): void {
    const factor = Math.min(1, dt * 0.03);

    if (snapshot.ring.active) {
      const colorId = this.source.getTurnColorId() ?? 1;
      this.ringSprite.setVisible(true);
      this.ringSprite.setTint(PLAYER_COLOR_HEX[colorId]);
      this.ringSprite.x += (snapshot.ring.x - this.ringSprite.x) * factor;
      this.ringSprite.y += (snapshot.ring.y - this.ringSprite.y) * factor;
      this.ringSprite.rotation += (snapshot.ring.rotation - this.ringSprite.rotation) * factor;
      return;
    }

    if (!this.dragging && this.source.canThrow()) {
      const myColor = this.source.getMyColorId() ?? 1;
      this.ringSprite.setVisible(true);
      this.ringSprite.setPosition(RING_HOME_X, RING_HOME_Y);
      this.ringSprite.setRotation(0);
      this.ringSprite.setTint(PLAYER_COLOR_HEX[myColor]);
    } else {
      this.ringSprite.setVisible(false);
    }
  }

  private handleCountdown(snapshot: MatchSnapshotLike): void {
    if (this.lastPhase !== snapshot.phase) {
      this.lastPhase = snapshot.phase;
      if (snapshot.phase === 'playing') playGo();
    }
    if (snapshot.countdownActive && snapshot.countdown !== this.lastCountdown) {
      this.lastCountdown = snapshot.countdown;
      playCountdownTick();
    }
    if (this.lastTurn !== snapshot.turn) {
      this.lastTurn = snapshot.turn;
      playTurnSwitch();
    }
  }

  private handleLanded(): void {
    const events = this.source.takeLanded();
    events.forEach((e) => {
      playScore(e.points);
      const visual = this.poleVisuals.find((v) => v.type === e.poleType);
      const x = visual ? visual.shaft.x : GAME_WIDTH / 2;
      const y = visual ? visual.shaft.y : 300;
      this.burst.explode(16, x, y);
      this.spawnFloatingText(x, y - 30, `+${e.points}`);
      this.spawnLandedRing(x, y, e.poleType as PoleType);
    });
  }

  /** Shows a ring resting on the pole top, then fades it out. */
  private spawnLandedRing(x: number, y: number, poleType: PoleType): void {
    const cfg = POLE_CONFIGS[poleType];
    const topY = y - cfg.height / 2;
    const color = this.source.getTurnColorId() ?? 1;
    const d = this.add.image(x, topY, 'ring')
      .setDepth(2)
      .setTint(PLAYER_COLOR_HEX[color])
      .setAlpha(0.95);
    this.tweens.add({
      targets: d,
      alpha: 0,
      duration: 800,
      onComplete: () => d.destroy(),
    });
  }

  private spawnFloatingText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    t.setOrigin(0.5);
    t.setStroke('#000000', 5);
    t.setDepth(25);
    this.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.source.canThrow()) return;
    const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, RING_HOME_X, RING_HOME_Y);
    if (distance > THROW_GRAB_RADIUS) return;
    this.dragging = true;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.ringSprite.setPosition(pointer.x, pointer.y);
    this.drawAim(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.aimGraphics.clear();
    this.ringSprite.setPosition(RING_HOME_X, RING_HOME_Y);

    const launch = computeLaunch(
      RING_HOME_X,
      RING_HOME_Y,
      pointer.x,
      pointer.y,
      MAX_DRAG,
      MAX_THROW_VELOCITY,
    );

    if (launch.power < MIN_THROW_VELOCITY) return;

    this.source.launch(launch.vx, launch.vy);
    playThrow();
  }

  private drawAim(pointerX: number, pointerY: number): void {
    this.aimGraphics.clear();
    const launch = computeLaunch(
      RING_HOME_X,
      RING_HOME_Y,
      pointerX,
      pointerY,
      MAX_DRAG,
      MAX_THROW_VELOCITY,
    );
    if (launch.power <= 0) return;

    const points = simulateTrajectory(
      RING_HOME_X,
      RING_HOME_Y,
      launch.vx,
      launch.vy,
      GRAVITY_Y,
      2.0,
      0.04,
      50,
    );

    this.aimGraphics.fillStyle(0xffffff, 0.85);
    points.forEach((p) => {
      if (p.y > this.groundTop) return;
      this.aimGraphics.fillCircle(p.x, p.y, 3);
    });
  }
}