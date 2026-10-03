import type { PoleConfig, PoleType } from './types';

// Arena (logical design size; the canvas is scaled to fit the screen).
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_HEIGHT = 70;

// Physics.
export const GRAVITY_Y = 1100;

// Match.
export const MATCH_DURATION_MS = 60_000;
export const COUNTDOWN_SECONDS = 3;
export const COUNTDOWN_STEP_MS = 1000;
export const TICK_MS = 1000 / 30;
export const END_THROW_DELAY_MS = 700;

// Match format: fixed attempts per player instead of a timer.
export const ATTEMPTS_PER_PLAYER = 5;
export const TIE_BREAKER_ATTEMPTS = 1;

// Ring.
export const RING_RADIUS = 17;
export const RING_HOME_X = 170;
export const RING_HOME_Y = GAME_HEIGHT - GROUND_HEIGHT - RING_RADIUS - 4;

// Throw.
export const MIN_THROW_VELOCITY = 220;
export const MAX_THROW_VELOCITY = 1400;
export const LANDING_MIN_VY = 120;

// Poles.
export const ZONE_HEIGHT = 60;
export const POLE_PATROL = 30;

export const POLE_PLACEMENT: { type: PoleType; x: number }[] = [
  { type: 'medium', x: 360 },
];

export const POLE_CONFIGS: Record<PoleType, PoleConfig> = {
  large: {
    type: 'large',
    points: 1,
    width: 44,
    height: 150,
    speed: 40,
    landingZoneWidth: 104,
    color: 0x8d6e63,
    label: '1',
  },
  medium: {
    type: 'medium',
    points: 3,
    width: 22,
    height: 110,
    speed: 25,
    landingZoneWidth: 200,
    color: 0x90a4ae,
    label: '3',
  },
  small: {
    type: 'small',
    points: 5,
    width: 26,
    height: 120,
    speed: 90,
    landingZoneWidth: 62,
    color: 0x7986cb,
    label: '5',
  },
  fast: {
    type: 'fast',
    points: 7,
    width: 22,
    height: 110,
    speed: 170,
    landingZoneWidth: 52,
    color: 0x4db6ac,
    label: '7',
  },
  golden: {
    type: 'golden',
    points: 10,
    width: 24,
    height: 150,
    speed: 80,
    landingZoneWidth: 46,
    color: 0xffd700,
    label: '10',
  },
};