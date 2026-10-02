import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import {
  ClientEvents,
  ServerEvents,
} from '../shared/protocol';
import type {
  AbortedEvent,
  CountdownEvent,
  LandedEvent,
  MatchResult,
  PlayerId,
  ReconnectPayload,
  ThrowEvent,
  TurnEvent,
} from '../shared/protocol';
import { ATTEMPTS_PER_PLAYER, MAX_THROW_VELOCITY, TICK_MS, TIE_BREAKER_ATTEMPTS } from '../shared/constants';
import { Room, RoomManager } from './roomManager';
import { MatchSimulation, type SimEvent } from './matchSimulation';
import { getEnv } from './env';
import { FallbackCommentaryProvider } from './ai/fallbackCommentary';
import { CommentaryManager } from './commentary/commentaryManager';
import { AIError, FallbackAICommentaryService, HttpAICommentaryService } from './ai/aiCommentaryService';
import { registerCommentarySocketHandlers } from './commentarySocket';

const RECONNECT_GRACE_MS = 15_000;

/** Strips disallowed characters and enforces the 2-20 char name rule. */
function sanitizeName(name: unknown): string {
  const raw = typeof name === 'string' ? name.trim() : '';
  const cleaned = raw.replace(/[^A-Za-z0-9 _-]/g, '');
  if (cleaned.length < 2 || cleaned.length > 20) return '';
  return cleaned;
}

function mapEvent(event: SimEvent): [string, unknown] {
  switch (event.type) {
    case 'countdown': {
      const payload: CountdownEvent = { value: event.value, active: event.active };
      return [ServerEvents.countdown, payload];
    }
    case 'go':
      return [ServerEvents.go, null];
    case 'throw-start': {
      const payload: ThrowEvent = { playerId: event.playerId };
      return [ServerEvents.throwStart, payload];
    }
    case 'landed': {
      const payload: LandedEvent = {
        playerId: event.playerId,
        points: event.points,
        poleType: event.poleType,
      };
      return [ServerEvents.landed, payload];
    }
    case 'turn': {
      const payload: TurnEvent = { playerId: event.playerId };
      return [ServerEvents.turn, payload];
    }
    case 'tie-breaker-start':
      return ['', null];
    case 'end': {
      const payload: MatchResult = event.result;
      return [ServerEvents.end, payload];
    }
    default:
      return ['', null];
  }
}

export interface StartOptions {
  port?: number;
}

export function startServer(options: StartOptions = {}) {
  const envPort = Number(process.env.PORT);
  const port = options.port ?? (Number.isFinite(envPort) ? envPort : 3001);

  const env = getEnv();
  const fallback = new FallbackCommentaryProvider();
  const service = env.AI_PROVIDER !== 'none' && env.AI_API_KEY
    ? new HttpAICommentaryService({
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
      baseUrl: env.AI_BASE_URL,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    })
    : new FallbackAICommentaryService(fallback);

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  const rooms = new RoomManager();

  // Serve the built frontend (production) if present.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(moduleDir, '..');
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  function initCommentary(room: Room): void {
    room.commentary = new CommentaryManager({
      service,
      fallback,
      minIntervalMs: env.COMMENTARY_MIN_INTERVAL_MS,
      broadcast: (update) => {
        const event = update.type === 'MATCH_END'
          ? ServerEvents.finalMatchRecap
          : ServerEvents.commentaryUpdate;
        io.to(room.code).emit(event, update);
      },
    });
    io.to(room.code).emit(ServerEvents.commentaryStatus, { enabled: service.enabled });
  }

  function feedCommentary(room: Room, event: SimEvent): void {
    const cm = room.commentary;
    if (!cm) return;
    const players = room.playerInputs();
    switch (event.type) {
      case 'go':
        cm.handleMatchStart(players);
        break;
      case 'landed':
        cm.handleLanded({
          playerId: event.playerId,
          points: event.points,
          scores: room.sim.scores,
          timeRemainingMs: 0,
          players,
        });
        break;
      case 'end':
        cm.handleMatchEnd(event.result, players);
        break;
      default:
        break;
    }
  }

  function attachTick(room: Room): void {
    if (room.tickInterval) return;
    room.tickInterval = setInterval(() => {
      room.sim.tick(TICK_MS);

      const events = room.events.splice(0, room.events.length);
      events.forEach((event) => {
        const [name, payload] = mapEvent(event);
        if (name) io.to(room.code).emit(name, payload);
        feedCommentary(room, event);
      });

      if (room.sim.phase !== 'idle') {
        io.to(room.code).emit(ServerEvents.snapshot, room.sim.snapshot());
      }

      if (room.players.length === 0) {
        if (room.tickInterval) clearInterval(room.tickInterval);
        rooms.delete(room.code);
      }
    }, TICK_MS);
  }

  function scheduleGraceAbort(room: Room, playerId: PlayerId): void {
    const existing = room.graceTimers.get(playerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      room.graceTimers.delete(playerId);
      const player = room.players.find((p) => p.playerId === playerId && p.disconnected);
      if (!player) return; // reconnected within grace

      room.removePlayerById(playerId);
      io.to(room.code).emit(ServerEvents.playerLeft, room.publicState());
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());

      if (room.players.length === 0) {
        if (room.tickInterval) clearInterval(room.tickInterval);
        rooms.delete(room.code);
        return;
      }
      if (room.sim.phase !== 'idle') {
        room.sim.reset();
        room.commentary?.reset();
        const payload: AbortedEvent = { message: 'Your opponent left the game.' };
        io.to(room.code).emit(ServerEvents.aborted, payload);
      }
    }, RECONNECT_GRACE_MS);
    room.graceTimers.set(playerId, timer);
  }

  function handleLeave(socketId: string, opts: { graceful?: boolean } = {}) {
    const room = rooms.bySocket(socketId);
    if (!room) return;
    const player = room.playerBySocket(socketId);
    if (!player) return;

    const midMatch = room.sim.phase !== 'idle';

    if (midMatch && opts.graceful !== false) {
      rooms.detachSocket(socketId);
      room.markDisconnected(socketId);
      io.to(room.code).emit(ServerEvents.playerLeft, room.publicState());
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());
      room.commentary?.handlePlayerDisconnected(room.playerInputs());
      scheduleGraceAbort(room, player.playerId);
      return;
    }

    room.removePlayerById(player.playerId);
    rooms.detachSocket(socketId);
    io.to(room.code).emit(ServerEvents.playerLeft, room.publicState());
    io.to(room.code).emit(ServerEvents.lobby, room.publicState());

    if (room.players.length === 0) {
      if (room.tickInterval) clearInterval(room.tickInterval);
      rooms.delete(room.code);
      return;
    }
    if (midMatch) {
      room.sim.reset();
      room.commentary?.reset();
      const payload: AbortedEvent = { message: 'Your opponent left the game.' };
      io.to(room.code).emit(ServerEvents.aborted, payload);
    }
  }

  io.on('connection', (socket) => {
    socket.on(ClientEvents.create, (payload: { name?: string }) => {
      const name = sanitizeName(payload?.name) || 'Player 1';
      const room = rooms.create(name, socket.id);
      socket.join(room.code);
      socket.emit(ServerEvents.created, {
        roomCode: room.code,
        players: room.playerInfos(),
        hostId: room.hostId,
        playerId: 1,
        reconnectToken: room.players[0].reconnectToken,
      });
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());
      initCommentary(room);
      attachTick(room);
    });

    socket.on(ClientEvents.join, (payload: { code?: string; name?: string }) => {
      const code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : '';
      const name = sanitizeName(payload?.name) || 'Player 2';
      const room = rooms.find(code);
      if (!room) {
        socket.emit(ServerEvents.error, { message: 'Room not found. Check the code.' });
        return;
      }
      if (room.players.length >= 2) {
        socket.emit(ServerEvents.error, { message: 'Room is full.' });
        return;
      }
      if (room.phaseStarted()) {
        socket.emit(ServerEvents.error, { message: 'Match already in progress.' });
        return;
      }
      const playerId = room.addPlayer(name, socket.id) as PlayerId;
      const player = room.playerBySocket(socket.id);
      socket.join(room.code);
      rooms.rebindSocket(room.code, socket.id);
      socket.emit(ServerEvents.joined, {
        roomCode: room.code,
        players: room.playerInfos(),
        hostId: room.hostId,
        playerId,
        reconnectToken: player?.reconnectToken ?? '',
      });
      io.to(room.code).emit(ServerEvents.playerJoined, room.publicState());
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());
      initCommentary(room);
      attachTick(room);
    });

    socket.on(ClientEvents.reconnect, (payload: ReconnectPayload) => {
      const code = typeof payload?.roomCode === 'string' ? payload.roomCode.trim().toUpperCase() : '';
      const token = typeof payload?.token === 'string' ? payload.token : '';
      const room = rooms.find(code);
      if (!room) {
        socket.emit(ServerEvents.error, { message: 'Room not found.' });
        return;
      }
      const player = room.reconnectPlayer(token, socket.id);
      if (!player) {
        socket.emit(ServerEvents.error, { message: 'Reconnection failed.' });
        return;
      }
      const timer = room.graceTimers.get(player.playerId);
      if (timer) clearTimeout(timer);
      room.graceTimers.delete(player.playerId);
      socket.join(room.code);
      rooms.rebindSocket(room.code, socket.id);
      socket.emit(ServerEvents.joined, {
        roomCode: room.code,
        players: room.playerInfos(),
        hostId: room.hostId,
        playerId: player.playerId,
        reconnectToken: player.reconnectToken,
      });
      io.to(room.code).emit(ServerEvents.playerJoined, room.publicState());
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());
      if (room.sim.phase !== 'idle') {
        io.to(room.code).emit(ServerEvents.snapshot, room.sim.snapshot());
      }
      room.commentary?.handlePlayerReconnected(room.playerInputs());
    });

    socket.on(ClientEvents.start, () => {
      const room = rooms.bySocket(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 2) {
        socket.emit(ServerEvents.error, { message: 'Waiting for an opponent.' });
        return;
      }
      if (room.sim.phase === 'idle') {
        room.sim = new MatchSimulation(
          (event) => room.events.push(event),
          {
            attemptsPerPlayer: Number(process.env.ATTEMPTS_PER_PLAYER) || ATTEMPTS_PER_PLAYER,
            tieBreakerAttempts: Number(process.env.TIE_BREAKER_ATTEMPTS) || TIE_BREAKER_ATTEMPTS,
          },
        );
      }
      room.commentary?.reset();
      room.sim.start();
    });

    socket.on(ClientEvents.launch, (payload: { vx?: number; vy?: number }) => {
      const room = rooms.bySocket(socket.id);
      if (!room) return;
      const player = room.playerBySocket(socket.id);
      if (!player) return;
      const { vx, vy } = payload ?? {};
      if (typeof vx !== 'number' || typeof vy !== 'number' || !Number.isFinite(vx) || !Number.isFinite(vy)) {
        return;
      }
      const clamp = (v: number) => Math.max(-MAX_THROW_VELOCITY, Math.min(MAX_THROW_VELOCITY, v));
      room.sim.launch(player.playerId, clamp(vx), clamp(vy));
    });

    socket.on(ClientEvents.rematch, () => {
      const room = rooms.bySocket(socket.id);
      if (!room) return;
      room.sim.reset();
      room.commentary?.reset();
      io.to(room.code).emit(ServerEvents.lobby, room.publicState());
    });

    socket.on(ClientEvents.leave, () => handleLeave(socket.id, { graceful: false }));

    socket.on('disconnect', () => handleLeave(socket.id, { graceful: true }));
  });

  // Local-game commentary bridge (same-origin, per connection).
  registerCommentarySocketHandlers(io, service, fallback, env.COMMENTARY_MIN_INTERVAL_MS);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(`[server] Port ${port} is already in use. Stop the other process or set a different PORT in .env.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Ring Toss Duel server listening on http://localhost:${port}`);
  });

  return { server, io, rooms };
}

// Start automatically when run directly (e.g. `npm run start` / `tsx server/index.ts`).
const isEntryPoint = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  startServer();
}