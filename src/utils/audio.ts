/**
 * Synthesized sound effects via the Web Audio API.
 * No audio asset files required.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Call from a user gesture (e.g. Start button) to unlock audio on mobile. */
export function initAudio(): void {
  getContext();
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.2,
  when = 0,
  slideTo?: number,
): void {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + when);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + when + duration);
  }
  gain.gain.setValueAtTime(0, c.currentTime + when);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + when);
  osc.stop(c.currentTime + when + duration + 0.05);
}

function noise(duration: number, volume = 0.2): void {
  const c = getContext();
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.8;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

export function playThrow(): void {
  noise(0.25, 0.25);
  tone(300, 0.2, 'sawtooth', 0.06, 0, 700);
}

export function playHit(): void {
  tone(180, 0.12, 'triangle', 0.25);
}

export function playScore(points: number): void {
  const base = 440 + Math.min(points, 10) * 40;
  tone(base, 0.1, 'sine', 0.22);
  tone(base * 1.5, 0.12, 'sine', 0.2, 0.08);
  tone(base * 2, 0.18, 'sine', 0.18, 0.16);
}

export function playCountdownTick(): void {
  tone(440, 0.12, 'square', 0.12);
}

export function playGo(): void {
  tone(660, 0.3, 'square', 0.2);
  tone(880, 0.35, 'square', 0.15, 0.05);
}

export function playTurnSwitch(): void {
  tone(520, 0.08, 'sine', 0.12);
}