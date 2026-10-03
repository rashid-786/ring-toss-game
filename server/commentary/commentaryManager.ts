import type { CommentaryStatus, CommentaryUpdate } from '../../shared/commentary';
import type { MatchResult, PlayerId } from '../../shared/types';
import type {
  CommentaryRequest,
  CommentaryResult,
} from '../types/commentary.types';
import { playerNameSchema } from '../ai/commentarySchema';
import type { FallbackCommentaryProvider } from '../ai/fallbackCommentary';
import type { AICommentaryService } from '../ai/aiCommentaryService';
import { detectLandedEvent } from './commentaryEvents';
import { CommentaryRateLimiter } from './commentaryRateLimiter';

export interface CommentaryPlayerInput {
  playerId: PlayerId;
  name: string;
}

export interface CommentaryManagerDeps {
  service: AICommentaryService;
  fallback: FallbackCommentaryProvider;
  minIntervalMs: number;
  broadcast: (update: CommentaryUpdate) => void;
  onStatus?: (status: CommentaryStatus) => void;
  now?: () => number;
}

/**
 * Per-room orchestrator. Receives verified server events, decides whether a
 * commentary is warranted, applies cooldown/dedupe, builds a sanitized AI
 * request, requests + validates AI output, and broadcasts the result. Any AI
 * failure falls back to local commentary. Never blocks or mutates gameplay.
 */
export class CommentaryManager {
  private rateLimiter: CommentaryRateLimiter;

  private prevScores: Record<PlayerId, number> = { 1: 0, 2: 0 };

  private prevLeader: PlayerId | null = null;

  private lastLandedPlayer: PlayerId | null = null;

  private leadChanges = 0;

  private highestValueThrow = 0;

  private finalTenSent = false;

  private ended = false;

  constructor(private deps: CommentaryManagerDeps) {
    this.rateLimiter = new CommentaryRateLimiter({
      minIntervalMs: deps.minIntervalMs,
      now: deps.now,
    });
  }

  reset(): void {
    this.rateLimiter.reset();
    this.prevScores = { 1: 0, 2: 0 };
    this.prevLeader = null;
    this.lastLandedPlayer = null;
    this.leadChanges = 0;
    this.highestValueThrow = 0;
    this.finalTenSent = false;
    this.ended = false;
  }

  isEnabled(): boolean {
    return this.deps.service.enabled;
  }

  // -------------------------------------------------------------------------
  // Event entry points
  // -------------------------------------------------------------------------

  handleMatchStart(players: CommentaryPlayerInput[]): void {
    if (this.ended) return;
    this.emit('MATCH_START', this.buildRequest('MATCH_START', players, {}));
  }

  handleLanded(input: {
    playerId: PlayerId;
    points: number;
    scores: Record<PlayerId, number>;
    timeRemainingMs: number;
    players: CommentaryPlayerInput[];
  }): void {
    if (this.ended) return;

    const detection = detectLandedEvent({
      playerId: input.playerId,
      points: input.points,
      prevScores: this.prevScores,
      lastLandedPlayer: this.lastLandedPlayer,
    });

    this.highestValueThrow = Math.max(this.highestValueThrow, input.points);
    if (detection.leadChanged) this.leadChanges += 1;
    this.prevLeader = detection.leader;
    this.lastLandedPlayer = input.playerId;
    this.prevScores = { ...input.scores };

    if (detection.eventType) {
      this.emit(
        detection.eventType,
        this.buildRequest(detection.eventType, input.players, {
          timeRemainingMs: input.timeRemainingMs,
          pointsScored: input.points,
          scorerName: this.displayName(input.players, input.playerId),
        }),
      );
    }
  }

  handleFinalTenSeconds(players: CommentaryPlayerInput[]): void {
    if (this.ended || this.finalTenSent) return;
    this.finalTenSent = true;
    this.emit('FINAL_TEN_SECONDS', this.buildRequest('FINAL_TEN_SECONDS', players, {}));
  }

  handleMatchEnd(result: MatchResult, players: CommentaryPlayerInput[]): void {
    this.ended = true;
    this.prevScores = { 1: result.player1Score, 2: result.player2Score };
    const isDraw = result.winner === null;
    const request = this.buildRequest('MATCH_END', players, {
      winner: isDraw ? undefined : this.displayName(players, result.winner as PlayerId),
      isDraw,
      leadChanges: this.leadChanges,
      highestValueThrow: this.highestValueThrow,
    });
    this.generateAndBroadcast(request);
  }

  handlePlayerDisconnected(players: CommentaryPlayerInput[]): void {
    if (this.ended) return;
    this.emit('PLAYER_DISCONNECTED', this.buildRequest('PLAYER_DISCONNECTED', players, {}));
  }

  handlePlayerReconnected(players: CommentaryPlayerInput[]): void {
    if (this.ended) return;
    this.emit('PLAYER_RECONNECTED', this.buildRequest('PLAYER_RECONNECTED', players, {}));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private emit(eventType: CommentaryRequest['eventType'], request: CommentaryRequest): void {
    if (!this.rateLimiter.canEmit(eventType)) return;
    this.rateLimiter.record(eventType);
    this.generateAndBroadcast(request);
  }

  /** Asynchronous, fire-and-forget so commentary never blocks gameplay. */
  private generateAndBroadcast(request: CommentaryRequest): void {
    this.deps.service.generate(request)
      .then((result) => {
        const safe = this.sanitizeResult(request, result);
        this.deps.broadcast({
          type: request.eventType,
          message: safe.commentary,
          tone: safe.tone,
          createdAt: Date.now(),
        });
      })
      .catch(() => {
        const fallback = this.deps.fallback.generate(request);
        this.deps.broadcast({
          type: request.eventType,
          message: fallback.commentary,
          tone: fallback.tone,
          createdAt: Date.now(),
        });
      });
  }

  private sanitizeResult(request: CommentaryRequest, result: CommentaryResult): CommentaryResult {
    return {
      ...result,
      commentary: result.commentary.trim().slice(0, 200) || this.deps.fallback.generate(request).commentary,
    };
  }

  private buildRequest(
    eventType: CommentaryRequest['eventType'],
    players: CommentaryPlayerInput[],
    extra: {
      timeRemainingMs?: number;
      pointsScored?: number;
      scorerName?: string;
      winner?: string;
      isDraw?: boolean;
      leadChanges?: number;
      highestValueThrow?: number;
    },
  ): CommentaryRequest {
    const scores = this.prevScores;

    return {
      eventType,
      player1: {
        playerId: 1,
        displayName: this.displayName(players, 1),
        score: scores[1],
      },
      player2: {
        playerId: 2,
        displayName: this.displayName(players, 2),
        score: scores[2],
      },
      leaderName: this.leaderName(players),
      scorerName: extra.scorerName,
      timeRemaining: extra.timeRemainingMs !== undefined
        ? Math.max(0, Math.ceil(extra.timeRemainingMs / 1000))
        : undefined,
      pointsScored: extra.pointsScored,
      winner: extra.winner,
      isDraw: extra.isDraw,
      leadChanges: extra.leadChanges,
      highestValueThrow: extra.highestValueThrow,
    };
  }

  private displayName(players: CommentaryPlayerInput[], playerId: PlayerId): string {
    const found = players.find((p) => p.playerId === playerId);
    const name = found?.name ?? `Player ${playerId}`;
    const parsed = playerNameSchema.safeParse(name);
    return parsed.success ? parsed.data : `Player ${playerId}`;
  }

  private leaderName(players: CommentaryPlayerInput[]): string | undefined {
    const [p1, p2] = [this.prevScores[1], this.prevScores[2]];
    if (p1 === p2) return undefined;
    const leader: PlayerId = p1 > p2 ? 1 : 2;
    return this.displayName(players, leader);
  }
}