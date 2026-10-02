import type { MatchResult, PlayerId, PoleType } from '../types/game';

export interface GameEventMap {
  'hud:countdown': { value: number; active: boolean };
  'hud:turn': { playerId: PlayerId };
  'hud:score': {
    playerId: PlayerId;
    score: number;
    delta: number;
    polePoints: number;
  };
  'hud:timer': { seconds: number };
  'hud:attempts': { attempts: Record<PlayerId, number>; tieBreaker: boolean; tieBreakerRound: number };
  'hud:match-end': { result: MatchResult };
  'game:landed': { playerId: PlayerId; poleType: PoleType; points: number };
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

class EventBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as (payload: unknown) => void);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new EventBus();