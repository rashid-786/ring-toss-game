import { useSyncExternalStore } from 'react';
import { io } from 'socket.io-client';
import { CommentarySocketEvents } from '../../shared/commentary';
import type { CommentaryStatus, CommentaryUpdate } from '../../shared/commentary';
import type { PlayerId } from '../../shared/types';

interface CommentaryState {
  items: CommentaryUpdate[];
  enabled: boolean;
  connected: boolean;
  recap: CommentaryUpdate | null;
}

let state: CommentaryState = { items: [], enabled: true, connected: false, recap: null };

let playerNames = { player1: 'Player 1', player2: 'Player 2' };

const socket = io({ autoConnect: false, transports: ['websocket', 'polling'] });

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function patch(p: Partial<CommentaryState>): void {
  state = { ...state, ...p };
  notify();
}

socket.on(CommentarySocketEvents.update, (update: CommentaryUpdate) => {
  patch({ items: [...state.items, update].slice(-30) });
});

socket.on('connect', () => patch({ connected: true }));
socket.on('disconnect', () => patch({ connected: false }));
socket.on('connect_error', () => patch({ connected: false }));

socket.on(CommentarySocketEvents.status, (status: CommentaryStatus) => {
  patch({ enabled: status.enabled });
});

socket.on(CommentarySocketEvents.recap, (update: CommentaryUpdate) => {
  patch({ recap: update, items: [...state.items, update].slice(-30) });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function setCommentaryPlayers(player1: string, player2: string): void {
  playerNames = { player1, player2 };
}

export function connectCommentary(): void {
  socket.connect();
}

export function disconnectCommentary(): void {
  socket.disconnect();
}

export function emitMatchStart(): void {
  socket.emit(CommentarySocketEvents.matchStart, {
    player1: { name: playerNames.player1 },
    player2: { name: playerNames.player2 },
  });
}

export function emitLanded(playerId: PlayerId, points: number, scores: Record<PlayerId, number>): void {
  socket.emit(CommentarySocketEvents.landed, {
    playerId,
    points,
    scores,
    player1: { name: playerNames.player1 },
    player2: { name: playerNames.player2 },
  });
}

export function emitMatchEnd(result: { player1Score: number; player2Score: number; winner: PlayerId | null }): void {
  socket.emit(CommentarySocketEvents.matchEnd, {
    result,
    player1: { name: playerNames.player1 },
    player2: { name: playerNames.player2 },
  });
}

/** Returns and clears pending commentary (consumed by the commentator panel). */
export function consumeCommentary(): CommentaryUpdate[] {
  const items = state.items;
  if (items.length > 0) state = { ...state, items: [] };
  return items;
}

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------

export function getCommentaryState(): CommentaryState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCommentary<T>(select: (s: CommentaryState) => T): T {
  return useSyncExternalStore(subscribe, () => select(getCommentaryState()));
}