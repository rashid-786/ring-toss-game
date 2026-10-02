import type { PlayerId } from '../types/game';

export const PLAYER_1_NAME = 'Player 1';
export const PLAYER_2_NAME = 'Player 2';

export const PLAYER_COLOR_HEX: Record<PlayerId, number> = {
  1: 0x2f7bff,
  2: 0xff5a4d,
};

export const PLAYER_CSS_COLORS: Record<PlayerId, string> = {
  1: '#2f7bff',
  2: '#ff5a4d',
};

export const INSTRUCTIONS_TEXT =
  'Throw the ring onto the moving pole to score points.\nPlayer 1 throws all 5 attempts, then Player 2. Highest score wins.';