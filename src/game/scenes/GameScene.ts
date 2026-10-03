import Phaser from 'phaser';
import { createTextures } from '../assets/textures';
import {
  computeLaunch,
  simulateTrajectory,
} from '../physics/ballistics';
import { Pole } from '../objects/Pole';
import { Ring } from '../objects/Ring';
import { GameState } from '../logic/GameState';
import { TurnManager } from '../logic/TurnManager';
import { calculateResult } from '../logic/Scoring';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
  GRAVITY_Y,
  ATTEMPTS_PER_PLAYER,
  LANDING_MIN_VY,
  MAX_DRAG,
  MAX_THROW_VELOCITY,
  MIN_THROW_VELOCITY,
  POLE_PATROL,
  POLE_PLACEMENT,
  POLE_CONFIGS,
  RING_HOME_X,
  RING_HOME_Y,
  THROW_GRAB_RADIUS,
} from '../../config/gameConfig';
import { PLAYER_COLOR_HEX } from '../../utils/constants';
import type { PlayerId } from '../../types/game';
import { bus } from '../../utils/events';
import { emitMatchStart, emitLanded, emitMatchEnd } from '../../net/commentary';
import {
  initAudio,
  playCountdownTick,
  playGo,
  playHit,
  playScore,
  playThrow,
  playTurnSwitch,
} from '../../utils/audio';

export class GameScene extends Phaser.Scene {
  private state = new GameState();

  private turns = new TurnManager();

  private poles: Pole[] = [];

  private ring!: Ring;

  private ground!: Phaser.GameObjects.Image;

  private groundTop = GAME_HEIGHT - GROUND_HEIGHT;

  private aimGraphics!: Phaser.GameObjects.Graphics;

  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  private countdownEvent?: Phaser.Time.TimerEvent;

  private dragging = false;

  private ringLaunched = false;

  private stillFrames = 0;

  private hasHitGround = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    initAudio();
    this.state.reset();
    this.turns.reset();

    createTextures(this);

    // Sky.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x7ec8e3).setOrigin(0).setDepth(-10);

    // Ground.
    this.ground = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, 'ground')
      .setDisplaySize(GAME_WIDTH, GROUND_HEIGHT)
      .setDepth(-5);
    this.physics.add.existing(this.ground, true);

    // Poles.
    const poleSpeed = Number(import.meta.env.VITE_POLE_SPEED) || undefined;
    this.poles = POLE_PLACEMENT.map(({ type, x }) => (
      new Pole(this, x, this.groundTop, POLE_CONFIGS[type], POLE_PATROL, poleSpeed)
    ));

    // Ring.
    this.ring = new Ring(this, RING_HOME_X, RING_HOME_Y, PLAYER_COLOR_HEX[1]);

    // Aim guide.
    this.aimGraphics = this.add.graphics().setDepth(15);

    // Reusable particle burst for score celebrations.
    this.burst = this.add.particles(0, 0, 'pixel', {
      speed: { min: 60, max: 240 },
      lifespan: 600,
      scale: { start: 0.7, end: 0 },
      quantity: 1,
      emitting: false,
      tint: [0xffffff, 0xffd700, 0xff8a00],
    });
    this.burst.setDepth(20);

    // Collisions.
    this.physics.add.collider(this.ring, this.ground, () => {
      if (this.ringLaunched && !this.hasHitGround) {
        this.hasHitGround = true;
        playHit();
      }
    });
    this.poles.forEach((pole) => {
      this.physics.add.overlap(this.ring, pole.zone, () => this.onPoleLand(pole));
    });

    // Throw input.
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    this.startCountdown();
  }

  update(_time: number, delta: number): void {
    this.poles.forEach((pole) => pole.update());

    if (!this.ringLaunched) return;

    const body = this.ring.getBody();

    // Visual tumble while flying.
    this.ring.rotation += (body.velocity.x / 320) * (delta / 1000);

    // Left the arena entirely.
    if (
      this.ring.y > GAME_HEIGHT + 120
      || this.ring.x < -120
      || this.ring.x > GAME_WIDTH + 120
    ) {
      this.finishThrow();
      return;
    }

    // Settled (stopped on the ground).
    if (body.speed < 6) {
      this.stillFrames += 1;
      if (this.stillFrames > 10) {
        this.finishThrow();
      }
    } else {
      this.stillFrames = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Countdown + match lifecycle
  // ---------------------------------------------------------------------------

  private startCountdown(): void {
    this.state.phase = 'countdown';
    let step = 0;

    const tick = () => {
      step += 1;
      if (step <= 3) {
        bus.emit('hud:countdown', { value: 4 - step, active: true });
        playCountdownTick();
      } else {
        bus.emit('hud:countdown', { value: 0, active: false });
        playGo();
        this.startMatch();
        this.countdownEvent?.destroy();
      }
    };

    tick();
    this.countdownEvent = this.time.addEvent({ delay: 1000, loop: true, callback: tick });
  }

  private startMatch(): void {
    this.state.phase = 'playing';
    this.turns.reset();

    this.ring.setPlayerColor(PLAYER_COLOR_HEX[this.turns.currentPlayer()]);
    this.emitAttempts();
    bus.emit('hud:turn', { playerId: this.turns.currentPlayer() });
    emitMatchStart();
  }

  private endMatch(): void {
    if (this.state.phase === 'ended') return;
    this.state.phase = 'ended';
    this.aimGraphics.clear();
    const result = calculateResult(this.state.scores);
    bus.emit('hud:match-end', { result });
    emitMatchEnd(result);
  }

  // ---------------------------------------------------------------------------
  // Throw input (slingshot drag)
  // ---------------------------------------------------------------------------

  private canThrow(): boolean {
    return this.state.phase === 'playing' && !this.ringLaunched;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.canThrow()) return;
    const distance = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.ring.homeX,
      this.ring.homeY,
    );
    if (distance > THROW_GRAB_RADIUS) return;
    this.dragging = true;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.ring.setPosition(pointer.x, pointer.y);
    this.updateAim(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.aimGraphics.clear();

    if (this.state.phase !== 'playing') {
      this.ring.setPosition(this.ring.homeX, this.ring.homeY);
      return;
    }

    const launch = computeLaunch(
      this.ring.homeX,
      this.ring.homeY,
      pointer.x,
      pointer.y,
      MAX_DRAG,
      MAX_THROW_VELOCITY,
    );

    if (launch.power < MIN_THROW_VELOCITY) {
      this.ring.setPosition(this.ring.homeX, this.ring.homeY);
      return;
    }

    this.ringLaunched = true;
    this.stillFrames = 0;
    this.hasHitGround = false;
    this.ring.launch(launch.vx, launch.vy);
    playThrow();
  }

  private updateAim(pointerX: number, pointerY: number): void {
    this.aimGraphics.clear();
    const launch = computeLaunch(
      this.ring.homeX,
      this.ring.homeY,
      pointerX,
      pointerY,
      MAX_DRAG,
      MAX_THROW_VELOCITY,
    );
    if (launch.power <= 0) return;

    const points = simulateTrajectory(
      this.ring.homeX,
      this.ring.homeY,
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

  // ---------------------------------------------------------------------------
  // Landing / turn flow
  // ---------------------------------------------------------------------------

  private onPoleLand(pole: Pole): void {
    if (!this.ringLaunched || this.state.phase !== 'playing') return;
    const body = this.ring.getBody();
    // Only a falling ring counts as a successful toss.
    if (body.velocity.y < LANDING_MIN_VY) return;

    const player = this.turns.currentPlayer();
    const points = pole.config.points;
    this.state.addScore(player, points);

    bus.emit('hud:score', {
      playerId: player,
      score: this.state.scores[player],
      delta: points,
      polePoints: points,
    });
    bus.emit('game:landed', { playerId: player, poleType: pole.config.type, points });
    emitLanded(player, points, { ...this.state.scores });

    playScore(points);
    this.spawnBurst(pole.zone.x, pole.zone.y);
    this.spawnFloatingText(pole.zone.x, pole.zone.y - 30, `+${points}`);
    this.spawnLandedRing(pole.zone.x, pole.zone.y, player);

    this.finishThrow();
  }

  private finishThrow(): void {
    this.ringLaunched = false;
    this.stillFrames = 0;
    this.ring.resetHome();

    if (this.state.phase === 'playing') {
      this.handleAttemptProgress();
    }
  }

  /**
   * Consumes an attempt for the current thrower, then advances to the next
   * thrower or ends the match / starts a tie-breaker once both players have
   * completed their regulation attempts.
   */
  private handleAttemptProgress(): void {
    const thrower = this.turns.currentPlayer();
    this.state.attempts[thrower] += 1;
    this.emitAttempts();

    if (!this.state.tieBreaker && this.state.bothDone(ATTEMPTS_PER_PLAYER)) {
      if (this.state.scores[1] === this.state.scores[2]) {
        this.startTieBreaker();
      } else {
        this.endMatch();
      }
      return;
    }

    if (this.state.tieBreaker && this.state.attempts[1] === this.state.attempts[2]) {
      // Both threw this sudden-death round -> compare total scores.
      if (this.state.scores[1] !== this.state.scores[2]) {
        this.endMatch();
        return;
      }
      this.state.tieBreakerRound += 1;
      this.turns.reset();
      bus.emit('hud:turn', { playerId: 1 });
      this.ring.setPlayerColor(PLAYER_COLOR_HEX[1]);
      playTurnSwitch();
      return;
    }

    const next = this.nextPlayer();
    this.turns.set(next);
    this.ring.setPlayerColor(PLAYER_COLOR_HEX[next]);
    bus.emit('hud:turn', { playerId: next });
    playTurnSwitch();
  }

  /** Regulation: Player 1 takes all 5 attempts first, then Player 2. Sudden death alternates. */
  private nextPlayer(): PlayerId {
    if (this.state.tieBreaker) {
      return this.state.attempts[1] <= this.state.attempts[2] ? 1 : 2;
    }
    return this.state.attempts[1] < ATTEMPTS_PER_PLAYER ? 1 : 2;
  }

  private startTieBreaker(): void {
    this.state.tieBreaker = true;
    this.state.tieBreakerRound = 1;
    this.turns.reset();
    this.emitAttempts();
    bus.emit('hud:turn', { playerId: 1 });
    this.ring.setPlayerColor(PLAYER_COLOR_HEX[1]);
    playTurnSwitch();
  }

  private emitAttempts(): void {
    bus.emit('hud:attempts', {
      attempts: { ...this.state.attempts },
      tieBreaker: this.state.tieBreaker,
      tieBreakerRound: this.state.tieBreakerRound,
    });
  }

  // ---------------------------------------------------------------------------
  // Visual helpers
  // ---------------------------------------------------------------------------

  private spawnBurst(x: number, y: number): void {
    this.burst.explode(16, x, y);
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

  private spawnLandedRing(x: number, y: number, player: 1 | 2): void {
    const d = this.add.image(x, y, 'ring')
      .setDepth(2)
      .setTint(PLAYER_COLOR_HEX[player])
      .setAlpha(0.9);
    this.tweens.add({
      targets: d,
      alpha: 0,
      scale: 1.25,
      duration: 700,
      onComplete: () => d.destroy(),
    });
  }
}