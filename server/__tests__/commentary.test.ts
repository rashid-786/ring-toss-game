import { describe, it, expect, vi, afterEach } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { CommentaryManager } from '../commentary/commentaryManager';
import { CommentaryRateLimiter } from '../commentary/commentaryRateLimiter';
import { detectLandedEvent } from '../commentary/commentaryEvents';
import { FallbackCommentaryProvider, DRAW_COMMENTARY } from '../ai/fallbackCommentary';
import { HttpAICommentaryService, FallbackAICommentaryService, AIError } from '../ai/aiCommentaryService';
import type { AICommentaryService } from '../ai/aiCommentaryService';
import type { CommentaryUpdate } from '../../shared/commentary';
import type { CommentaryRequest, CommentaryResult } from '../types/commentary.types';
import type { PlayerId } from '../../shared/types';
import { startServer } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const players: Array<{ playerId: PlayerId; name: string }> = [
  { playerId: 1, name: 'Mohammad' },
  { playerId: 2, name: 'Rizwan' },
];

class MockService implements AICommentaryService {
  enabled = true;

  requests: CommentaryRequest[] = [];

  mode: 'ok' | 'timeout' | 'invalid' | 'http' | 'unsafe' = 'ok';

  async generate(request: CommentaryRequest): Promise<CommentaryResult> {
    this.requests.push(request);
    if (this.mode === 'timeout') throw new AIError('timeout', 'timed out');
    if (this.mode === 'invalid') throw new AIError('schema_error', 'invalid response');
    if (this.mode === 'http') throw new AIError('http_error', 'http 500');
    if (this.mode === 'unsafe') {
      throw new AIError('unsafe_content', 'failed moderation');
    }
    return {
      eventType: request.eventType,
      commentary: 'The crowd goes wild!',
      tone: 'excited',
    };
  }
}

function makeManager(overrides?: {
  service?: AICommentaryService;
  minIntervalMs?: number;
}) {
  const broadcasts: CommentaryUpdate[] = [];
  const manager = new CommentaryManager({
    service: overrides?.service ?? new MockService(),
    fallback: new FallbackCommentaryProvider(),
    minIntervalMs: overrides?.minIntervalMs ?? 0,
    broadcast: (u) => broadcasts.push(u),
  });
  return { manager, broadcasts };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Lead-change detection
// ---------------------------------------------------------------------------

describe('event detection', () => {
  it('detects a lead change', () => {
    const { eventType } = detectLandedEvent({
      playerId: 2,
      points: 3,
      prevScores: { 1: 1, 2: 0 },
      lastLandedPlayer: 1,
    });
    expect(eventType).toBe('LEAD_CHANGE');
  });

  it('detects a tie', () => {
    const { eventType } = detectLandedEvent({
      playerId: 2,
      points: 5,
      prevScores: { 1: 5, 2: 0 },
      lastLandedPlayer: 1,
    });
    expect(eventType).toBe('TIE_SCORE');
  });
});

// ---------------------------------------------------------------------------
// 2 / 3. Tie detection + final-ten-seconds (fires once)
// ---------------------------------------------------------------------------

describe('CommentaryManager', () => {
  it('emits FIRST_SCORE then TIE_SCORE in sequence', async () => {
    const { manager, broadcasts } = makeManager();
    manager.handleLanded({ playerId: 1, points: 5, scores: { 1: 5, 2: 0 }, timeRemainingMs: 50000, players });
    manager.handleLanded({ playerId: 2, points: 5, scores: { 1: 5, 2: 5 }, timeRemainingMs: 40000, players });
    await flush();
    expect(broadcasts.map((b) => b.type)).toEqual(['FIRST_SCORE', 'TIE_SCORE']);
  });

  it('emits FINAL_TEN_SECONDS only once', async () => {
    const { manager, broadcasts } = makeManager();
    manager.handleFinalTenSeconds(players);
    manager.handleFinalTenSeconds(players);
    manager.handleFinalTenSeconds(players);
    await flush();
    expect(broadcasts.filter((b) => b.type === 'FINAL_TEN_SECONDS')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Commentary cooldown
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('blocks a second message within the cooldown window', () => {
    let now = 0;
    const limiter = new CommentaryRateLimiter({ minIntervalMs: 5000, now: () => now });
    expect(limiter.canEmit('MATCH_START')).toBe(true);
    limiter.record('MATCH_START');
    now = 1000;
    expect(limiter.canEmit('LEAD_CHANGE')).toBe(false);
    now = 6000;
    expect(limiter.canEmit('LEAD_CHANGE')).toBe(true);
  });

  it('always allows MATCH_END regardless of cooldown', () => {
    let now = 0;
    const limiter = new CommentaryRateLimiter({ minIntervalMs: 5000, now: () => now });
    limiter.record('LEAD_CHANGE');
    expect(limiter.canEmit('MATCH_END')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Duplicate prevention
// ---------------------------------------------------------------------------

describe('duplicate prevention', () => {
  it('does not repeat the same event type consecutively', async () => {
    const { manager, broadcasts } = makeManager();
    manager.handleMatchStart(players);
    manager.handleMatchStart(players);
    await flush();
    expect(broadcasts.filter((b) => b.type === 'MATCH_START')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6 / 7 / 8. AI failure fallbacks (timeout, invalid, unsafe)
// ---------------------------------------------------------------------------

describe('fallback on AI failure', () => {
  it('uses fallback when the AI request times out', async () => {
    const service = new MockService();
    service.mode = 'timeout';
    const { manager, broadcasts } = makeManager({ service });
    manager.handleMatchStart(players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].message).toContain('Let the Ring Toss Duel begin!');
  });

  it('uses fallback when the AI response is invalid', async () => {
    const service = new MockService();
    service.mode = 'invalid';
    const { manager, broadcasts } = makeManager({ service });
    manager.handleMatchStart(players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].message).toContain('Let the Ring Toss Duel begin!');
  });

  it('uses fallback when AI content is unsafe (moderation rejects)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          eventType: 'MATCH_START',
          commentary: 'You are an idiot at this game',
          tone: 'excited',
        }) } }],
      }),
    })));

    const service = new HttpAICommentaryService({
      provider: 'openai',
      apiKey: 'test-key',
      timeoutMs: 1000,
    });
    const { manager, broadcasts } = makeManager({ service });
    manager.handleMatchStart(players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].message).toContain('Let the Ring Toss Duel begin!');
  });
});

// ---------------------------------------------------------------------------
// 9 / 10. Match-end recap + draw commentary
// ---------------------------------------------------------------------------

describe('match end', () => {
  it('always emits a MATCH_END recap using the server winner', async () => {
    const { manager, broadcasts } = makeManager();
    manager.handleMatchEnd({ player1Score: 12, player2Score: 8, winner: 1 }, players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].type).toBe('MATCH_END');
  });

  it('emits the draw fallback for a drawn match', async () => {
    const service = new MockService();
    service.mode = 'http';
    const { manager, broadcasts } = makeManager({ service });
    manager.handleMatchEnd({ player1Score: 8, player2Score: 8, winner: null }, players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].message).toBe(DRAW_COMMENTARY);
  });
});

// ---------------------------------------------------------------------------
// 11. Special characters in player names
// ---------------------------------------------------------------------------

describe('input sanitization', () => {
  it('sanitizes special characters in player names before sending to AI', async () => {
    const service = new MockService();
    const { manager } = makeManager({ service });
    const evilPlayers = [
      { playerId: 1 as PlayerId, name: '<script>alert(1)</script>' },
      { playerId: 2 as PlayerId, name: 'Héllo_Wörld!' },
    ];
    manager.handleMatchStart(evilPlayers);
    await flush();
    expect(service.requests[0].player1.displayName).toBe('Player 1');
    expect(service.requests[0].player2.displayName).toBe('Player 2');
  });
});

// ---------------------------------------------------------------------------
// 12. Commentary events arriving after match end are ignored
// ---------------------------------------------------------------------------

describe('staleness', () => {
  it('ignores landed events after the match has ended', async () => {
    const { manager, broadcasts } = makeManager();
    manager.handleMatchEnd({ player1Score: 5, player2Score: 3, winner: 1 }, players);
    manager.handleLanded({ playerId: 1, points: 1, scores: { 1: 6, 2: 3 }, timeRemainingMs: 0, players });
    manager.handleFinalTenSeconds(players);
    await flush();
    expect(broadcasts.filter((b) => b.type === 'MATCH_END')).toHaveLength(1);
    expect(broadcasts.filter((b) => b.type !== 'MATCH_END')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 13. AI service unavailable
// ---------------------------------------------------------------------------

describe('AI unavailable', () => {
  it('falls back to local commentary when no AI provider is configured', async () => {
    const fallback = new FallbackCommentaryProvider();
    const service = new FallbackAICommentaryService(fallback);
    const { manager, broadcasts } = makeManager({ service });
    expect(manager.isEnabled()).toBe(true);
    manager.handleMatchStart(players);
    await flush();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].message).toContain('Let the Ring Toss Duel begin!');
  });
});

// ---------------------------------------------------------------------------
// 14. Socket broadcast to both players
// ---------------------------------------------------------------------------

describe('online room multiplayer', () => {
  it('runs a 2-player room and streams commentary to both players', async () => {
    const started = startServer({ port: 0 });
    const { server } = started;
    await new Promise((r) => setTimeout(r, 300));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server has no port');
    const url = `http://localhost:${address.port}`;

    const c1: Socket = io(url, { transports: ['websocket', 'polling'] });
    const c2: Socket = io(url, { transports: ['websocket', 'polling'] });
    await Promise.all([
      new Promise<void>((r) => c1.on('connect', () => r())),
      new Promise<void>((r) => c2.on('connect', () => r())),
    ]);

    const created = await new Promise<{ roomCode: string }>((r) => {
      c1.once('room:created', (p: { roomCode: string }) => r(p));
      c1.emit('room:create', { name: 'Host' });
    });
    await new Promise<void>((r) => {
      c2.emit('room:join', { code: created.roomCode, name: 'Guest' });
      c2.once('room:joined', () => r());
    });

    // Register listeners before the match starts (commentary arrives on GO).
    const got1 = new Promise<{ type: string }>((r) => c1.once('commentary_update', r));
    const got2 = new Promise<{ type: string }>((r) => c2.once('commentary_update', r));
    const snap = new Promise<{ phase: string }>((r) => c1.once('game:snapshot', r));

    c1.emit('room:start');

    const [u1, u2] = await Promise.all([got1, got2]);
    expect(u1.type).toBe('MATCH_START');
    expect(u2.type).toBe('MATCH_START');

    const s = await snap;
    expect(s.phase).toBeDefined();

    c1.disconnect();
    c2.disconnect();
    await new Promise<void>((r) => server.close(() => r()));
  });
});

describe('commentary socket bridge', () => {
  it('receives commentary status and match-start commentary', async () => {
    const started = startServer({ port: 0 });
    const { server } = started;
    // Wait for the ephemeral port to be bound before connecting.
    await new Promise((r) => setTimeout(r, 300));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server has no port');
    const url = `http://localhost:${address.port}`;

    const c1: Socket = io(url, { transports: ['websocket', 'polling'] });
    // Register listeners before the connection completes so early events
    // (commentary_status) are not missed.
    const connected = new Promise<void>((resolve, reject) => {
      c1.on('connect', () => resolve());
      c1.on('connect_error', (err) => reject(err));
    });
    const status = new Promise<{ enabled: boolean }>((r) => c1.once('commentary_status', r));
    const update = new Promise<{ type: string }>((r) => c1.once('commentary_update', r));
    await connected;

    expect((await status).enabled).toBe(true);

    c1.emit('commentary:match-start', {
      player1: { name: 'Mohammad' },
      player2: { name: 'Rizwan' },
    });

    const u = await update;
    expect(u.type).toBe('MATCH_START');

    c1.disconnect();
    await new Promise<void>((r) => server.close(() => r()));
  });
});