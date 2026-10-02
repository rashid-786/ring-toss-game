import type { Server } from 'socket.io';
import { CommentarySocketEvents } from '../shared/commentary';
import type { CommentaryUpdate } from '../shared/commentary';
import { CommentaryManager } from './commentary/commentaryManager';
import type { AICommentaryService } from './ai/aiCommentaryService';
import type { FallbackCommentaryProvider } from './ai/fallbackCommentary';
import type { PlayerId } from '../shared/types';

function toPlayers(payload: {
  player1?: { name?: string };
  player2?: { name?: string };
} | undefined) {
  return [
    { playerId: 1 as PlayerId, name: payload?.player1?.name || 'Player 1' },
    { playerId: 2 as PlayerId, name: payload?.player2?.name || 'Player 2' },
  ];
}

/**
 * Commentary-only socket bridge for the local game. The client streams verified
 * match events (start / landed / end) and the server generates commentary via a
 * per-connection CommentaryManager, broadcasting it straight back to that
 * connection. Clients can never inject commentary text or choose tones.
 */
export function registerCommentarySocketHandlers(
  io: Server,
  service: AICommentaryService,
  fallback: FallbackCommentaryProvider,
  minIntervalMs: number,
): void {
  io.on('connection', (socket) => {
    const manager = new CommentaryManager({
      service,
      fallback,
      minIntervalMs,
      broadcast: (update: CommentaryUpdate) => {
        const event = update.type === 'MATCH_END'
          ? CommentarySocketEvents.recap
          : CommentarySocketEvents.update;
        socket.emit(event, update);
      },
    });

    socket.emit(CommentarySocketEvents.status, { enabled: service.enabled });

    socket.on(CommentarySocketEvents.matchStart, (payload) => {
      manager.reset();
      manager.handleMatchStart(toPlayers(payload));
    });

    socket.on(CommentarySocketEvents.landed, (payload: {
      playerId?: PlayerId;
      points?: number;
      scores?: Partial<Record<PlayerId, number>>;
      player1?: { name?: string };
      player2?: { name?: string };
    }) => {
      manager.handleLanded({
        playerId: payload?.playerId === 2 ? 2 : 1,
        points: Number(payload?.points) || 0,
        scores: {
          1: Number(payload?.scores?.[1]) || 0,
          2: Number(payload?.scores?.[2]) || 0,
        },
        timeRemainingMs: 0,
        players: toPlayers(payload),
      });
    });

    socket.on(CommentarySocketEvents.matchEnd, (payload: {
      result?: { player1Score?: number; player2Score?: number; winner?: PlayerId | null };
      player1?: { name?: string };
      player2?: { name?: string };
    }) => {
      const result = payload?.result ?? {};
      manager.handleMatchEnd(
        {
          player1Score: Number(result.player1Score) || 0,
          player2Score: Number(result.player2Score) || 0,
          winner: result.winner ?? null,
        },
        toPlayers(payload),
      );
    });
  });
}