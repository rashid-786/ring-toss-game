import type { PlayerId } from '../../types/game';

/** Tracks which player throws. Pure state, no Phaser deps. */
export class TurnManager {
  private current: PlayerId = 1;

  reset(): void {
    this.current = 1;
  }

  set(playerId: PlayerId): void {
    this.current = playerId;
  }

  currentPlayer(): PlayerId {
    return this.current;
  }
}