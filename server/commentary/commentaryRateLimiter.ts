import { ALWAYS_EMIT_TYPES } from '../../shared/commentary';
import type { CommentaryEventType } from '../../shared/commentary';

export interface RateLimiterOptions {
  minIntervalMs: number;
  now?: () => number;
}

/**
 * Enforces:
 *  - at most one live commentary message every `minIntervalMs`
 *  - MATCH_END always passes
 *
 * The min interval alone throttles spam; consecutive same-type events (e.g. a
 * streak of landings) are all emitted so every throw gets its commentary.
 */
export class CommentaryRateLimiter {
  private lastAt = -1;

  private now: () => number;

  constructor(private options: RateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  reset(): void {
    this.lastAt = -1;
  }

  canEmit(type: CommentaryEventType): boolean {
    if (ALWAYS_EMIT_TYPES.includes(type)) return true;
    if (this.lastAt < 0) return true; // nothing emitted yet
    const elapsed = this.now() - this.lastAt;
    if (elapsed < this.options.minIntervalMs) return false;
    return true;
  }

  record(type: CommentaryEventType): void {
    this.lastAt = this.now();
  }
}