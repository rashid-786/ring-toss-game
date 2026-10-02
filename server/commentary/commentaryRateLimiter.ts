import { ALWAYS_EMIT_TYPES } from '../../shared/commentary';
import type { CommentaryEventType } from '../../shared/commentary';

export interface RateLimiterOptions {
  minIntervalMs: number;
  now?: () => number;
}

/**
 * Enforces:
 *  - at most one live commentary message every `minIntervalMs`
 *  - no consecutive repeats of the same event type
 *  - MATCH_END always passes
 */
export class CommentaryRateLimiter {
  private lastAt = -1;

  private lastType: CommentaryEventType | null = null;

  private now: () => number;

  constructor(private options: RateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  reset(): void {
    this.lastAt = -1;
    this.lastType = null;
  }

  canEmit(type: CommentaryEventType): boolean {
    if (ALWAYS_EMIT_TYPES.includes(type)) return true;
    if (this.lastType === type) return false;
    if (this.lastAt < 0) return true; // nothing emitted yet
    const elapsed = this.now() - this.lastAt;
    if (elapsed < this.options.minIntervalMs) return false;
    return true;
  }

  record(type: CommentaryEventType): void {
    this.lastAt = this.now();
    this.lastType = type;
  }
}