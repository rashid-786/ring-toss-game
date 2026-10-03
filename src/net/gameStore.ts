import { useSyncExternalStore } from 'react';
import { socket, connectSocket, disconnectSocket } from './socket';
import {
  ClientEvents,
  ServerEvents,
} from '../../shared/protocol';
import type {
  CreatedPayload,
  JoinedPayload,
  LandedEvent,
  LobbyState,
  MatchResult,
  Phase,
  PlayerId,
  ServerSnapshot,
} from '../../shared/protocol';
import type {
  CommentaryStatus,
  CommentaryUpdate,
} from '../../shared/commentary';

export interface StoreState {
  connected: boolean;
  error: string | null;
  room: LobbyState | null;
  myPlayerId: PlayerId | null;
  isHost: boolean;
  phase: Phase;
  snapshot: ServerSnapshot | null;
  landedQueue: LandedEvent[];
  result: MatchResult | null;
  abortMessage: string | null;
  goFlash: boolean;
  commentary: CommentaryUpdate[];
  recap: CommentaryUpdate | null;
  commentaryEnabled: boolean;
  commentaryLanguage: string;
}

const initialState: StoreState = {
  connected: false,
  error: null,
  room: null,
  myPlayerId: null,
  isHost: false,
  phase: 'idle',
  snapshot: null,
  landedQueue: [],
  result: null,
  abortMessage: null,
  goFlash: false,
  commentary: [],
  recap: null,
  commentaryEnabled: true,
  commentaryLanguage: 'English',
};

let state: StoreState = { ...initialState };

/** Reconnect credentials for this session (not exposed to React). */
let roomCreds: { roomCode: string; token: string } | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function patch(p: Partial<StoreState>): void {
  state = { ...state, ...p };
  notify();
}

function setRoomFrom(room: LobbyState, playerId: PlayerId, isHost: boolean): void {
  patch({
    room,
    myPlayerId: playerId,
    isHost,
    error: null,
    result: null,
    abortMessage: null,
    phase: state.phase === 'idle' ? 'idle' : state.phase,
  });
}

socket.on('connect', () => {
  patch({ connected: true, error: null });
  if (roomCreds) {
    socket.emit(ClientEvents.reconnect, roomCreds);
  }
});

socket.on('disconnect', () => {
  patch({ connected: false });
});

socket.on(ServerEvents.error, (e: { message: string }) => {
  patch({ error: e.message });
});

socket.on(ServerEvents.created, (p: CreatedPayload) => {
  roomCreds = { roomCode: p.roomCode, token: p.reconnectToken };
  setRoomFrom(
    { roomCode: p.roomCode, players: p.players, hostId: p.hostId },
    p.playerId,
    true,
  );
});

socket.on(ServerEvents.joined, (p: JoinedPayload) => {
  roomCreds = { roomCode: p.roomCode, token: p.reconnectToken };
  setRoomFrom(
    { roomCode: p.roomCode, players: p.players, hostId: p.hostId },
    p.playerId,
    false,
  );
});

socket.on(ServerEvents.lobby, (l: LobbyState) => {
  patch({ room: l, error: null });
});

socket.on(ServerEvents.playerJoined, (l: LobbyState) => {
  patch({ room: l });
});

socket.on(ServerEvents.playerLeft, (l: LobbyState) => {
  patch({ room: l });
});

socket.on(ServerEvents.aborted, (e: { message: string }) => {
  patch({ phase: 'aborted', abortMessage: e.message });
});

socket.on(ServerEvents.snapshot, (s: ServerSnapshot) => {
  patch({ snapshot: s, phase: s.phase });
});

socket.on(ServerEvents.landed, (e: LandedEvent) => {
  patch({ landedQueue: [...state.landedQueue, e] });
});

socket.on(ServerEvents.go, () => {
  patch({ goFlash: true });
});

socket.on(ServerEvents.end, (result: MatchResult) => {
  patch({ result, phase: 'ended' });
});

socket.on(ServerEvents.commentaryUpdate, (update: CommentaryUpdate) => {
  patch({ commentary: [...state.commentary, update].slice(-30) });
});

socket.on(ServerEvents.commentaryStatus, (status: CommentaryStatus) => {
  patch({ commentaryEnabled: status.enabled, commentaryLanguage: status.language ?? 'English' });
});

socket.on(ServerEvents.finalMatchRecap, (update: CommentaryUpdate) => {
  patch({
    recap: update,
    commentary: [...state.commentary, update].slice(-30),
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function connectGame(): void {
  connectSocket();
}

export function disconnectGame(): void {
  disconnectSocket();
}

export function createRoom(name: string): void {
  socket.emit(ClientEvents.create, { name });
}

export function joinRoom(code: string, name: string): void {
  socket.emit(ClientEvents.join, { code, name });
}

export function startMatch(): void {
  socket.emit(ClientEvents.start);
}

export function launchRing(vx: number, vy: number): void {
  socket.emit(ClientEvents.launch, { vx, vy });
}

export function rematch(): void {
  socket.emit(ClientEvents.rematch);
}

export function leaveRoom(): void {
  socket.emit(ClientEvents.leave);
}

export function clearGoFlash(): void {
  patch({ goFlash: false });
}

/** Returns and clears pending landed events (consumed by the Phaser scene). */
export function takeLandedEvents(): LandedEvent[] {
  const q = state.landedQueue;
  if (q.length > 0) {
    state = { ...state, landedQueue: [] };
  }
  return q;
}

/** Returns and clears pending commentary (consumed by the commentator panel). */
export function consumeCommentary(): CommentaryUpdate[] {
  const items = state.commentary;
  if (items.length > 0) {
    state = { ...state, commentary: [] };
  }
  return items;
}

export function resetStore(): void {
  roomCreds = null;
  state = { ...initialState };
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------

export function getGameState(): StoreState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGame<T>(select: (s: StoreState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(getGameState()),
  );
}