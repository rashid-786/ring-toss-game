import { randomBytes } from 'node:crypto';
import type { LobbyState, PlayerInfo } from '../shared/protocol';
import type { PlayerId } from '../shared/types';
import { MatchSimulation, type SimEvent } from './matchSimulation';
import type { CommentaryManager } from './commentary/commentaryManager';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface RoomPlayer {
  id: string;
  socketId: string;
  playerId: PlayerId;
  name: string;
  reconnectToken: string;
  disconnected: boolean;
  disconnectedAt: number | null;
}

export class Room {
  code: string;

  players: RoomPlayer[] = [];

  hostId = '';

  tickInterval: ReturnType<typeof setInterval> | null = null;

  events: SimEvent[] = [];

  sim: MatchSimulation;

  commentary: CommentaryManager | null = null;

  graceTimers = new Map<PlayerId, ReturnType<typeof setTimeout>>();

  constructor(code: string, socketId: string, name: string) {
    this.code = code;
    this.hostId = socketId;
    this.sim = new MatchSimulation((event) => this.events.push(event));
    this.addPlayer(name, socketId);
  }

  addPlayer(name: string, socketId: string): PlayerId {
    const playerId: PlayerId = this.players.length === 0 ? 1 : 2;
    this.players.push({
      id: socketId,
      socketId,
      playerId,
      name,
      reconnectToken: randomBytes(16).toString('hex'),
      disconnected: false,
      disconnectedAt: null,
    });
    return playerId;
  }

  playerBySocket(socketId: string): RoomPlayer | undefined {
    return this.players.find((p) => p.socketId === socketId);
  }

  playerByToken(token: string): RoomPlayer | undefined {
    return this.players.find((p) => p.reconnectToken === token);
  }

  markDisconnected(socketId: string): RoomPlayer | undefined {
    const player = this.playerBySocket(socketId);
    if (!player) return undefined;
    player.disconnected = true;
    player.disconnectedAt = Date.now();
    return player;
  }

  reconnectPlayer(token: string, socketId: string): RoomPlayer | undefined {
    const player = this.playerByToken(token);
    if (!player || !player.disconnected) return undefined;
    player.socketId = socketId;
    player.id = socketId;
    player.disconnected = false;
    player.disconnectedAt = null;
    return player;
  }

  removePlayerById(playerId: PlayerId): void {
    const timer = this.graceTimers.get(playerId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(playerId);
    this.players = this.players.filter((p) => p.playerId !== playerId);
  }

  playerInfos(): PlayerInfo[] {
    return this.players.map((p) => ({
      id: p.playerId,
      name: p.name,
      playerId: p.playerId,
    }));
  }

  playerInputs(): Array<{ playerId: PlayerId; name: string }> {
    return this.players.map((p) => ({ playerId: p.playerId, name: p.name }));
  }

  publicState(): LobbyState {
    return {
      roomCode: this.code,
      players: this.playerInfos(),
      hostId: this.hostId,
    };
  }

  phaseStarted(): boolean {
    return this.sim.phase !== 'idle';
  }
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  private socketToCode = new Map<string, string>();

  create(name: string, socketId: string): Room {
    let code = generateCode();
    while (this.rooms.has(code)) {
      code = generateCode();
    }
    const room = new Room(code, socketId, name);
    this.rooms.set(code, room);
    this.socketToCode.set(socketId, code);
    return room;
  }

  find(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  bySocket(socketId: string): Room | null {
    const code = this.socketToCode.get(socketId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  detachSocket(socketId: string): void {
    this.socketToCode.delete(socketId);
  }

  rebindSocket(roomCode: string, socketId: string): void {
    this.socketToCode.set(socketId, roomCode);
  }

  removeSocket(socketId: string): Room | null {
    const room = this.bySocket(socketId);
    if (room) {
      const player = room.playerBySocket(socketId);
      if (player) room.removePlayerById(player.playerId);
      if (room.players.length === 0) {
        this.rooms.delete(room.code);
      }
    }
    this.socketToCode.delete(socketId);
    return room;
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }
}