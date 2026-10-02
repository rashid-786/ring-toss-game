import type { PlayerId } from '../../types/game';

/** Tracks which player throws and alternates turns. Pure state, no Phaser deps. */
export class TurnManager {
  private current: PlayerId = 1;

  reset(): void {
    this.current = 1;
  }

  currentPlayer(): PlayerId {
    return this.current;
  }

  next(): PlayerId {
    this.current = this.current === 1 ? 2 : 1;
    return this.current;
  }
}