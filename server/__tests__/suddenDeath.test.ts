import { describe, it, expect } from 'vitest';
import { MatchSimulation, type SimEvent } from '../matchSimulation';
import { TICK_MS } from '../../shared/constants';

function createSim(maxTieRounds = 2) {
  const events: SimEvent[] = [];
  const sim = new MatchSimulation((event) => events.push(event), {
    attemptsPerPlayer: 1,
    maxTieRounds,
  });
  sim.start();
  let guard = 0;
  while (sim.phase !== 'playing' && guard < 1000) {
    sim.tick(TICK_MS);
    guard += 1;
  }
  expect(sim.phase).toBe('playing');
  return { sim, events };
}

/** Throws the ring far off-screen so the current turn always misses. */
function playMiss(sim: MatchSimulation): void {
  let guard = 0;
  while (!sim.canLaunch(sim.turn)) {
    sim.tick(TICK_MS);
    guard += 1;
    if (guard > 1000) throw new Error('turn never became launchable');
  }
  expect(sim.launch(sim.turn, 100000, 0)).toBe(true);

  guard = 0;
  while (sim.phase !== 'ended' && !sim.canLaunch(sim.turn)) {
    sim.tick(TICK_MS);
    guard += 1;
    if (guard > 1000) throw new Error('turn never resolved');
  }
}

describe('sudden death', () => {
  it('keeps playing past maxTieRounds until the scores differ', () => {
    const { sim, events } = createSim(2);

    playMiss(sim);
    playMiss(sim);
    expect(sim.tieBreaker).toBe(true);

    for (let round = 0; round < 10; round += 1) {
      playMiss(sim);
      playMiss(sim);
    }

    expect(sim.tieBreakerRound).toBeGreaterThan(2);
    expect(sim.phase).toBe('playing');
    expect(events.some((event) => event.type === 'end')).toBe(false);
    expect(sim.result().winner).toBeNull();
  });

  it('declares the player with the higher score when scores finally differ', () => {
    const { sim, events } = createSim(2);

    playMiss(sim);
    playMiss(sim);
    expect(sim.tieBreaker).toBe(true);

    sim.scores[1] += 1;

    playMiss(sim);
    playMiss(sim);

    expect(sim.phase).toBe('ended');
    expect(sim.result()).toMatchObject({ player1Score: 1, player2Score: 0, winner: 1 });
    expect(events.some((event) => event.type === 'end')).toBe(true);
  });
});
