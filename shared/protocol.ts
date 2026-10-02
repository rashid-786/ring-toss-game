import type { MatchResult, Phase, PlayerId, PoleType } from './types';
import type { CommentaryStatus, CommentaryUpdate } from './commentary';

export interface PlayerInfo {
  id: number;
  name: string;
  playerId: PlayerId;
}

export interface LobbyState {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
}

export interface PoleSnapshot {
  index: number;
  x: number;
}

export interface RingSnapshot {
  active: boolean;
  x: number;
  y: number;
  rotation: number;
  playerId: PlayerId | null;
}

export interface ServerSnapshot {
  phase: Phase;
  countdown: number;
  countdownActive: boolean;
  timeRemainingMs: number;
  turn: PlayerId;
  scores: Record<PlayerId, number>;
  poles: PoleSnapshot[];
  ring: RingSnapshot;
  attempts?: Record<PlayerId, number>;
  tieBreaker?: boolean;
  tieBreakerRound?: number;
}

export interface LandedEvent {
  playerId: PlayerId;
  points: number;
  poleType: PoleType;
}

export interface RoomError {
  message: string;
}

export interface CreatedPayload {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  playerId: PlayerId;
  reconnectToken: string;
}

export interface JoinedPayload {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  playerId: PlayerId;
  reconnectToken: string;
}

export interface CountdownEvent {
  value: number;
  active: boolean;
}

export interface ThrowEvent {
  playerId: PlayerId;
}

export interface TurnEvent {
  playerId: PlayerId;
}

export interface AbortedEvent {
  message: string;
}

export interface ReconnectPayload {
  roomCode: string;
  token: string;
}

export const ClientEvents = {
  create: 'room:create',
  join: 'room:join',
  leave: 'room:leave',
  start: 'room:start',
  launch: 'throw:launch',
  rematch: 'room:rematch',
  reconnect: 'room:reconnect',
} as const;

export const ServerEvents = {
  created: 'room:created',
  joined: 'room:joined',
  error: 'room:error',
  lobby: 'room:update',
  playerJoined: 'player:joined',
  playerLeft: 'player:left',
  aborted: 'room:aborted',
  snapshot: 'game:snapshot',
  countdown: 'game:countdown',
  go: 'game:go',
  throwStart: 'game:throw',
  landed: 'game:landed',
  turn: 'game:turn',
  end: 'game:end',
  commentaryUpdate: 'commentary_update',
  commentaryStatus: 'commentary_status',
  finalMatchRecap: 'final_match_recap',
} as const;

export type {
  CommentaryStatus,
  CommentaryUpdate,
  MatchResult,
  Phase,
  PlayerId,
  PoleType,
};