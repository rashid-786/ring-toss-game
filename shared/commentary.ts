/**
 * Commentary domain types shared between the server (producer) and the
 * client (consumer). Event types, tones and socket payload shapes.
 */

export const COMMENTARY_EVENT_TYPES = [
  'MATCH_START',
  'FIRST_SCORE',
  'SCORE',
  'LEAD_CHANGE',
  'TIE_SCORE',
  'HIGH_VALUE_SCORE',
  'COMBO',
  'COMEBACK',
  'FINAL_TEN_SECONDS',
  'MATCH_END',
  'PLAYER_DISCONNECTED',
  'PLAYER_RECONNECTED',
] as const;

export type CommentaryEventType = typeof COMMENTARY_EVENT_TYPES[number];

export const COMMENTARY_TONES = [
  'excited',
  'dramatic',
  'funny',
  'neutral',
  'celebratory',
] as const;

export type CommentaryTone = typeof COMMENTARY_TONES[number];

/** Payload broadcast to clients on `commentary_update` / `final_match_recap`. */
export interface CommentaryUpdate {
  type: CommentaryEventType;
  message: string;
  tone: CommentaryTone;
  createdAt: number;
}

/** Payload broadcast to clients on `commentary_status`. */
export interface CommentaryStatus {
  enabled: boolean;
  reason?: string;
  language?: string;
}

/** Priority used by the rate limiter to favor meaningful events. */
export const COMMENTARY_PRIORITY: Record<CommentaryEventType, number> = {
  MATCH_END: 100,
  FIRST_SCORE: 50,
  SCORE: 40,
  HIGH_VALUE_SCORE: 60,
  COMBO: 55,
  COMEBACK: 55,
  LEAD_CHANGE: 45,
  TIE_SCORE: 45,
  FINAL_TEN_SECONDS: 40,
  MATCH_START: 30,
  PLAYER_DISCONNECTED: 35,
  PLAYER_RECONNECTED: 35,
};

/** Events that always bypass the cooldown window. */
export const ALWAYS_EMIT_TYPES: CommentaryEventType[] = [
  'MATCH_END',
];

/** Socket events for the local-game commentary bridge. */
export const CommentarySocketEvents = {
  update: 'commentary_update',
  status: 'commentary_status',
  recap: 'final_match_recap',
  matchStart: 'commentary:match-start',
  landed: 'commentary:landed',
  matchEnd: 'commentary:match-end',
} as const;