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

/** Primes speech synthesis so commentary TTS works after a user gesture. */
export function primeSpeech(): void {
  try {
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.resume();
  } catch {
    // speech synthesis unavailable
  }
}

// Chrome silently stops speech synthesis after a few utterances / ~15s. It does
// not set `paused`; it just never starts new utterances. A global watchdog that
// nudges the engine keeps it alive across the whole session.
let speechWatchdog: number | null = null;

function ensureSpeechWatchdog(): void {
  if (speechWatchdog !== null) return;
  speechWatchdog = window.setInterval(() => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.resume();
      if (synth.paused) synth.resume();
    } catch {
      // ignore
    }
  }, 2500);
}

/**
 * Robust text-to-speech. Cancels any in-flight utterance, then speaks with a
 * retry-on-silent-failure guard: if Chrome drops the utterance without ever
 * starting it (reported by a missing `onstart`), it retries a few times.
 */
export function speakText(
  text: string,
  lang = 'en-US',
  opts: { volume?: number; rate?: number; pitch?: number } = {},
): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  ensureSpeechWatchdog();

  const clean = text
    .replace(/!{2,}/g, '!')
    .replace(/!/g, '.')
    .replace(/\.{3,}/g, '.')
    .trim();

  let attempts = 0;
  const trySpeak = (): void => {
    if (attempts >= 3) return;
    attempts += 1;
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.volume = opts.volume ?? 0.9;
      utterance.rate = opts.rate ?? 1;
      utterance.pitch = opts.pitch ?? 1;
      let started = false;
      const silentTimer = window.setTimeout(() => {
        if (!started) trySpeak(); // dropped silently -> retry
      }, 650);
      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => window.clearTimeout(silentTimer);
      utterance.onerror = () => {
        window.clearTimeout(silentTimer);
        trySpeak();
      };
      synth.speak(utterance);
      synth.resume();
    } catch {
      // speech synthesis unavailable
    }
  };
  window.setTimeout(trySpeak, 40);
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

// ---------- Ambience: match-day crowd + stadium groove ----------

const AMBIENT_BUS_VOL = 0.6;
const STADIUM_BPM = 108;
const STADIUM_EIGHTH = 60 / STADIUM_BPM / 2; // ~0.278s

/** Driving stadium roots: F, C, Bb, F. */
const STADIUM_BASS = [87.31, 65.41, 58.27, 87.31];

let ambientBus: GainNode | null = null;
let crowdNodes: AudioScheduledSourceNode[] = [];
let murmurGain: GainNode | null = null;
let roarGain: GainNode | null = null;
let swellTimer: number | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let musicNextT = 0;
let ambienceStarted = false;
let ambienceMuted = false;
let intense = false;

function musicTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  when: number,
): void {
  if (!ambientBus) return;
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain).connect(ambientBus);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

function musicNoise(
  duration: number,
  freq: number,
  q: number,
  volume: number,
  when: number,
): void {
  if (!ambientBus) return;
  const c = getContext();
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.connect(filter).connect(gain).connect(ambientBus);
  src.start(when);
}

/** Stadium "olé"-style chant pitch pairs (G4 → A4). */
const CHANT_UP = 392.0;
const CHANT_DOWN = 440.0;

/** Choir-ish "ooh" voice for the football chant (two detuned saws + lowpass). */
function chantTone(freq: number, duration: number, volume: number, when: number): void {
  if (!ambientBus) return;
  const c = getContext();
  const osc1 = c.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;
  const osc2 = c.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = freq * 1.006;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 880;
  filter.Q.value = 4;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.09);
  gain.gain.setValueAtTime(volume, when + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ambientBus);
  osc1.start(when);
  osc1.stop(when + duration + 0.05);
  osc2.start(when);
  osc2.stop(when + duration + 0.05);
}

function scheduleStadiumStep(step: number, t: number): void {
  const bar = Math.floor(step / 8) % 4;
  const s = step % 8;
  // Bass drum thump on beats 1 & 3.
  if (s === 0 || s === 4) {
    musicTone(78, 0.14, 'sine', 0.18, t);
    musicTone(58, 0.09, 'sine', 0.14, t);
  }
  // Hands/feet clap on beats 2 & 4.
  if (s === 2 || s === 6) {
    musicNoise(0.09, 1500, 1.1, 0.11, t);
  }
  // Shaker on the off-beats.
  if (s % 2 === 1) {
    musicNoise(0.04, 6500, 0.7, 0.022, t);
  }
  // Stadium bass line: root then fifth.
  if (s === 0) musicTone(STADIUM_BASS[bar], 0.2, 'triangle', 0.055, t);
  if (s === 4) musicTone(STADIUM_BASS[bar] * 1.5, 0.2, 'triangle', 0.05, t);
  // Football chant — a repeated "olé" two-note figure each bar.
  const chantVol = intense ? 0.06 : 0.045;
  if (s === 0) chantTone(CHANT_DOWN, 0.2, chantVol, t);
  if (s === 2) chantTone(CHANT_UP, 0.2, chantVol, t);
  if (s === 4) chantTone(CHANT_DOWN, 0.2, chantVol, t);
  if (s === 6) chantTone(CHANT_UP, 0.5, chantVol, t);
}

function startMusic(): void {
  musicStep = 0;
  musicNextT = getContext().currentTime + 0.15;
  musicTimer = window.setInterval(() => {
    const c = getContext();
    while (musicNextT < c.currentTime + 0.3) {
      scheduleStadiumStep(musicStep, musicNextT);
      musicStep += 1;
      musicNextT += STADIUM_EIGHTH;
    }
  }, 180);
}

/**
 * Starts the match-day ambience: a present crowd murmur plus a "roar" layer
 * that surges periodically, and a football-style drum/percussion groove.
 * Must be called after a user gesture (audio context already unlocked).
 */
export function startAmbience(): void {
  const c = getContext();
  if (ambienceStarted) return;
  ambienceStarted = true;

  if (!ambientBus) {
    ambientBus = c.createGain();
    ambientBus.gain.value = ambienceMuted ? 0 : AMBIENT_BUS_VOL;
    ambientBus.connect(c.destination);
  }

  const makeLoop = (brown: boolean) => {
    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = brown ? (last + 0.02 * white) / 1.02 : white;
      d[i] = brown ? last * 3.5 : white * 0.7;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  };

  // Crowd murmur bed — always present, clearly audible.
  const murmurSrc = makeLoop(true);
  const murmurFilter = c.createBiquadFilter();
  murmurFilter.type = 'lowpass';
  murmurFilter.frequency.value = 460;
  murmurGain = c.createGain();
  murmurGain.gain.value = intense ? 0.16 : 0.11;
  murmurSrc.connect(murmurFilter).connect(murmurGain).connect(ambientBus);

  // Roar layer — swells like a stadium going up after a big moment.
  const roarSrc = makeLoop(false);
  const roarFilter = c.createBiquadFilter();
  roarFilter.type = 'bandpass';
  roarFilter.frequency.value = 650;
  roarFilter.Q.value = 0.6;
  roarGain = c.createGain();
  roarGain.gain.value = intense ? 0.045 : 0.02;
  roarSrc.connect(roarFilter).connect(roarGain).connect(ambientBus);

  crowdNodes = [murmurSrc, roarSrc];

  // Periodic roar surges with random height/timing.
  const scheduleSwell = () => {
    if (!roarGain || !ctx) {
      swellTimer = window.setTimeout(scheduleSwell, 3600);
      return;
    }
    const now = ctx.currentTime;
    const base = intense ? 0.045 : 0.02;
    const peak = intense ? 0.09 : 0.05 + Math.random() * 0.03;
    roarGain.gain.cancelScheduledValues(now);
    roarGain.gain.setValueAtTime(base, now);
    roarGain.gain.linearRampToValueAtTime(peak, now + 1.1);
    roarGain.gain.linearRampToValueAtTime(base, now + 2.4);
    swellTimer = window.setTimeout(scheduleSwell, 3400 + Math.random() * 2600);
  };
  scheduleSwell();

  startMusic();
}

/** Ramp the crowd up for tense moments (e.g. sudden death). */
export function setAmbienceIntense(on: boolean): void {
  intense = on;
  if (ctx) {
    const now = ctx.currentTime;
    if (murmurGain) murmurGain.gain.setTargetAtTime(on ? 0.16 : 0.11, now, 1.2);
    if (roarGain) roarGain.gain.setTargetAtTime(on ? 0.045 : 0.02, now, 1.2);
  }
}

/** Stops the music and crowd layers (call when leaving the match screen). */
export function stopAmbience(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (swellTimer !== null) {
    window.clearTimeout(swellTimer);
    swellTimer = null;
  }
  crowdNodes.forEach((n) => {
    try {
      n.stop();
    } catch {
      // already stopped
    }
  });
  crowdNodes = [];
  murmurGain = null;
  roarGain = null;
  if (ambientBus) {
    try {
      ambientBus.disconnect();
    } catch {
      // ignore
    }
    ambientBus = null;
  }
  ambienceStarted = false;
}

export function setAmbienceMuted(muted: boolean): void {
  ambienceMuted = muted;
  if (ambientBus && ctx) {
    ambientBus.gain.setTargetAtTime(muted ? 0 : AMBIENT_BUS_VOL, ctx.currentTime, 0.1);
  }
}

export function isAmbienceMuted(): boolean {
  return ambienceMuted;
}

/** Crowd cheer burst — used on a landed ring. */
export function playCheer(intensity = 1): void {
  const c = getContext();
  const dur = 0.9;
  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.8;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(1900, c.currentTime + dur);
  filter.Q.value = 1.1;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.18 * intensity, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  tone(523, 0.12, 'triangle', 0.14);
  tone(659, 0.12, 'triangle', 0.14, 0.09);
  tone(784, 0.24, 'triangle', 0.15, 0.18);
}