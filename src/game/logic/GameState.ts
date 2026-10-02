import { ATTEMPTS_PER_PLAYER } from '../../config/gameConfig';
import type { Phase, PlayerId } from '../../types/game';

export class GameState {
  phase: Phase = 'idle';

  scores: Record<PlayerId, number> = { 1: 0, 2: 0 };

  attempts: Record<PlayerId, number> = { 1: 0, 2: 0 };

  tieBreaker = false;

  tieBreakerRound = 0;

  reset(): void {
    this.phase = 'idle';
    this.scores = { 1: 0, 2: 0 };
    this.attempts = { 1: 0, 2: 0 };
    this.tieBreaker = false;
    this.tieBreakerRound = 0;
  }

  addScore(playerId: PlayerId, points: number): void {
    this.scores[playerId] += points;
  }

  bothDone(attemptsPerPlayer = ATTEMPTS_PER_PLAYER): boolean {
    return this.attempts[1] >= attemptsPerPlayer && this.attempts[2] >= attemptsPerPlayer;
  }
}