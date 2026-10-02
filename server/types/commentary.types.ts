import type { CommentaryEventType, CommentaryTone } from '../../shared/commentary';
import type { PlayerId } from '../../shared/types';

export interface CommentaryPlayer {
  playerId: PlayerId;
  displayName: string;
  score: number;
}

/** Minimal, sanitized data sent to the AI. No socket ids, tokens or secrets. */
export interface CommentaryRequest {
  eventType: CommentaryEventType;
  player1: CommentaryPlayer;
  player2: CommentaryPlayer;
  leaderName?: string;
  timeRemaining?: number;
  pointsScored?: number;
  winner?: string;
  isDraw?: boolean;
  leadChanges?: number;
  highestValueThrow?: number;
}

export interface CommentaryResult {
  eventType: CommentaryEventType;
  commentary: string;
  tone: CommentaryTone;
}

export interface CommentaryContext {
  playerId: PlayerId;
  points: number;
  scores: Record<PlayerId, number>;
  timeRemainingMs: number;
  players: Array<{ playerId: PlayerId; name: string }>;
}

export interface MatchStats {
  leadChanges: number;
  highestValueThrow: number;
}