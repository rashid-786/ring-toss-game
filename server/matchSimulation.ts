import {
  COUNTDOWN_SECONDS,
  COUNTDOWN_STEP_MS,
  END_THROW_DELAY_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY_Y,
  GROUND_HEIGHT,
  LANDING_MIN_VY,
  POLE_CONFIGS,
  POLE_PATROL,
  POLE_PLACEMENT,
  RING_HOME_X,
  RING_HOME_Y,
  RING_RADIUS,
  ZONE_HEIGHT,
} from '../shared/constants';
import type { MatchResult, Phase, PlayerId, PoleType } from '../shared/types';
import type { PoleSnapshot, RingSnapshot, ServerSnapshot } from '../shared/protocol';

export type SimEvent =
  | { type: 'countdown'; value: number; active: boolean }
  | { type: 'go' }
  | { type: 'throw-start'; playerId: PlayerId }
  | { type: 'landed'; playerId: PlayerId; points: number; poleType: PoleType }
  | { type: 'turn'; playerId: PlayerId }
  | { type: 'tie-breaker-start'; round: number }
  | { type: 'end'; result: MatchResult };

export interface SimOptions {
  attemptsPerPlayer?: number;
  tieBreakerAttempts?: number;
  poleSpeed?: number;
}

interface RingSim {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
}

interface Patrol {
  dir: 1 | -1;
  speed: number;
  minX: number;
  maxX: number;
}

/**
 * Authoritative 2-player match engine. Match format: each player gets a fixed
 * number of attempts (5 by default), alternating turns with no timer. A tie
 * after regulation starts sudden-death tie-breaker rounds until a winner
 * exists. The server owns the poles, ring projectile, landing detection, turns,
 * scores and winner — clients only send launch velocities.
 */
export class MatchSimulation {
  phase: Phase = 'idle';

  countdownValue = 0;

  countdownActive = false;

  turn: PlayerId = 1;

  scores: Record<PlayerId, number> = { 1: 0, 2: 0 };

  attempts: Record<PlayerId, number> = { 1: 0, 2: 0 };

  tieBreaker = false;

  tieBreakerRound = 0;

  poles: PoleSnapshot[] = [];

  private ring: RingSim = {
    active: false,
    x: RING_HOME_X,
    y: RING_HOME_Y,
    vx: 0,
    vy: 0,
    rotation: 0,
  };

  private groundTop = GAME_HEIGHT - GROUND_HEIGHT;

  private patrol: Patrol[] = [];

  private countdownMs = 0;

  private turnSwitchAt: number | null = null;

  private nowMs = 0;

  private ended = false;

  private attemptsPerPlayer: number;

  private tieBreakerAttempts: number;

  constructor(private emit: (event: SimEvent) => void, options: SimOptions = {}) {
    this.attemptsPerPlayer = options.attemptsPerPlayer ?? 5;
    this.tieBreakerAttempts = options.tieBreakerAttempts ?? 1;
    this.poleSpeed = options.poleSpeed;
    this.initPoles();
  }

  private poleSpeed: number | undefined;

  private initPoles(): void {
    this.patrol = [];
    this.poles = POLE_PLACEMENT.map(({ type, x }, index) => {
      const cfg = POLE_CONFIGS[type];
      const half = cfg.landingZoneWidth / 2;
      this.patrol.push({
        dir: 1,
        speed: Math.abs(this.poleSpeed ?? cfg.speed),
        minX: Math.max(half, x - POLE_PATROL),
        maxX: Math.min(GAME_WIDTH - half, x + POLE_PATROL),
      });
      return { index, x };
    });
  }

  reset(): void {
    this.phase = 'idle';
    this.countdownValue = 0;
    this.countdownActive = false;
    this.turn = 1;
    this.scores = { 1: 0, 2: 0 };
    this.attempts = { 1: 0, 2: 0 };
    this.tieBreaker = false;
    this.tieBreakerRound = 0;
    this.ring = {
      active: false,
      x: RING_HOME_X,
      y: RING_HOME_Y,
      vx: 0,
      vy: 0,
      rotation: 0,
    };
    this.countdownMs = 0;
    this.turnSwitchAt = null;
    this.nowMs = 0;
    this.ended = false;
    this.initPoles();
  }

  start(): void {
    this.reset();
    this.phase = 'countdown';
    this.countdownActive = true;
    this.countdownValue = COUNTDOWN_SECONDS;
    this.emit({ type: 'countdown', value: COUNTDOWN_SECONDS, active: true });
  }

  canLaunch(playerId: PlayerId): boolean {
    return (
      this.phase === 'playing'
      && this.turn === playerId
      && !this.ring.active
      && this.turnSwitchAt === null
    );
  }

  launch(playerId: PlayerId, vx: number, vy: number): boolean {
    if (!this.canLaunch(playerId)) return false;

    const speed = Math.hypot(vx, vy);
    if (speed <= 0) return false;

    this.ring = {
      active: true,
      x: RING_HOME_X,
      y: RING_HOME_Y,
      vx,
      vy,
      rotation: 0,
    };
    this.emit({ type: 'throw-start', playerId });
    return true;
  }

  tick(dtMs: number): void {
    if (this.ended) return;
    this.nowMs += dtMs;

    if (this.phase === 'countdown') {
      this.countdownMs += dtMs;
      if (this.countdownMs >= COUNTDOWN_STEP_MS) {
        this.countdownMs -= COUNTDOWN_STEP_MS;
        this.countdownValue -= 1;
        if (this.countdownValue > 0) {
          this.emit({ type: 'countdown', value: this.countdownValue, active: true });
        } else {
          this.countdownActive = false;
          this.phase = 'playing';
          this.turn = 1;
          this.emit({ type: 'go' });
          this.emit({ type: 'turn', playerId: this.turn });
        }
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.movePoles(dtMs);

    if (this.ring.active) {
      this.integrateRing(dtMs);
    } else if (this.turnSwitchAt !== null && this.nowMs >= this.turnSwitchAt) {
      this.turnSwitchAt = null;
      this.turn = this.nextThrower();
      this.emit({ type: 'turn', playerId: this.turn });
    }
  }

  private movePoles(dtMs: number): void {
    const s = dtMs / 1000;
    this.poles.forEach((pole, index) => {
      const p = this.patrol[index];
      pole.x += p.dir * p.speed * s;
      if (pole.x <= p.minX) {
        pole.x = p.minX;
        p.dir = 1;
      } else if (pole.x >= p.maxX) {
        pole.x = p.maxX;
        p.dir = -1;
      }
    });
  }

  private integrateRing(dtMs: number): void {
    const s = dtMs / 1000;

    this.ring.vy += GRAVITY_Y * s;
    this.ring.x += this.ring.vx * s;
    this.ring.y += this.ring.vy * s;
    this.ring.rotation += (this.ring.vx / 320) * s;

    // Landing mimics the local game: the ring's body touches the pole's
    // landing-zone rectangle while falling.
    if (this.ring.vy > LANDING_MIN_VY) {
      for (let i = 0; i < this.poles.length; i += 1) {
        const pole = this.poles[i];
        const type = POLE_PLACEMENT[pole.index].type;
        const cfg = POLE_CONFIGS[type];
        const zoneY = this.groundTop - cfg.height - ZONE_HEIGHT / 2;
        const withinX = Math.abs(this.ring.x - pole.x) <= cfg.landingZoneWidth / 2 + RING_RADIUS;
        const withinY = Math.abs(this.ring.y - zoneY) <= ZONE_HEIGHT / 2 + RING_RADIUS;
        if (withinX && withinY) {
          this.handleLanding(type, cfg.points);
          return;
        }
      }
    }

    if (
      this.ring.x < -120
      || this.ring.x > GAME_WIDTH + 120
      || this.ring.y > GAME_HEIGHT + 120
    ) {
      this.endThrow();
      return;
    }

    if (this.ring.y >= this.groundTop - RING_RADIUS) {
      this.ring.y = this.groundTop - RING_RADIUS;
      if (this.ring.vy > 0) this.ring.vy = -this.ring.vy * 0.25;
      this.ring.vx *= 0.85;
      if (Math.abs(this.ring.vy) < 30 && Math.abs(this.ring.vx) < 20) {
        this.endThrow();
      }
    }
  }

  private handleLanding(type: PoleType, points: number): void {
    const thrower = this.turn;
    this.scores[thrower] += points;
    this.emit({ type: 'landed', playerId: thrower, points, poleType: type });
    this.ring.active = false;
    this.advanceAfterThrow();
  }

  private endThrow(): void {
    this.ring.active = false;
    this.advanceAfterThrow();
  }

  private advanceAfterThrow(): void {
    const thrower = this.turn;
    this.attempts[thrower] += 1;

    if (!this.tieBreaker) {
      const bothDone = this.attempts[1] >= this.attemptsPerPlayer
        && this.attempts[2] >= this.attemptsPerPlayer;
      if (bothDone) {
        if (this.scores[1] === this.scores[2]) {
          this.startTieBreaker();
        } else {
          this.finishMatch();
        }
        return;
      }
    } else if (this.attempts[1] === this.attempts[2]) {
      // Both threw this sudden-death round -> compare total scores.
      if (this.scores[1] !== this.scores[2]) {
        this.finishMatch();
        return;
      }
      this.tieBreakerRound += 1;
      this.emit({ type: 'tie-breaker-start', round: this.tieBreakerRound });
    }

    this.turnSwitchAt = this.nowMs + END_THROW_DELAY_MS;
  }

  private nextThrower(): PlayerId {
    if (this.tieBreaker) {
      // Sudden death: alternate champion -> challenger each round.
      return this.attempts[1] <= this.attempts[2] ? 1 : 2;
    }
    // Regulation: Player 1 takes all attempts first, then Player 2.
    return this.attempts[1] < this.attemptsPerPlayer ? 1 : 2;
  }

  private startTieBreaker(): void {
    this.tieBreaker = true;
    this.tieBreakerRound = 1;
    this.emit({ type: 'tie-breaker-start', round: 1 });
    this.turnSwitchAt = this.nowMs + END_THROW_DELAY_MS;
  }

  private finishMatch(): void {
    this.phase = 'ended';
    this.ended = true;
    this.ring.active = false;
    this.emit({ type: 'end', result: this.result() });
  }

  result(): MatchResult {
    const player1Score = this.scores[1];
    const player2Score = this.scores[2];
    let winner: PlayerId | null = null;
    if (player1Score > player2Score) winner = 1;
    else if (player2Score > player1Score) winner = 2;
    return { player1Score, player2Score, winner };
  }

  snapshot(): ServerSnapshot {
    return {
      phase: this.phase,
      countdown: this.countdownValue,
      countdownActive: this.countdownActive,
      timeRemainingMs: 0,
      turn: this.turn,
      scores: { ...this.scores },
      poles: this.poles.map((p) => ({ index: p.index, x: p.x })),
      ring: {
        active: this.ring.active,
        x: this.ring.x,
        y: this.ring.y,
        rotation: this.ring.rotation,
        playerId: null,
      },
      attempts: { ...this.attempts },
      tieBreaker: this.tieBreaker,
      tieBreakerRound: this.tieBreakerRound,
    };
  }
}