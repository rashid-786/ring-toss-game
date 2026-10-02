export type PlayerId = 1 | 2;

export type Phase = 'idle' | 'countdown' | 'playing' | 'ended' | 'aborted';

export type PoleType = 'large' | 'medium' | 'small' | 'fast' | 'golden';

export interface PoleConfig {
  type: PoleType;
  points: number;
  width: number;
  height: number;
  /** Horizontal patrol speed in px/s (absolute value). */
  speed: number;
  /** Width of the landing band at the top of the pole. Smaller = harder. */
  landingZoneWidth: number;
  color: number;
  label: string;
}

export interface MatchResult {
  player1Score: number;
  player2Score: number;
  winner: PlayerId | null;
}