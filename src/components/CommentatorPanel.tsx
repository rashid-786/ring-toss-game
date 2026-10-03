import { useEffect, useRef, useState } from 'react';
import {
  consumeCommentary as consumeBridgeCommentary,
  useCommentary,
} from '../net/commentary';
import {
  consumeCommentary as consumeOnlineCommentary,
  useGame,
} from '../net/gameStore';
import type { CommentaryUpdate, CommentaryTone } from '../../shared/commentary';

const MAX_QUEUE = 3;
const MESSAGE_MS = 4000;

const TONE_CLASS: Record<CommentaryTone, string> = {
  excited: 'tone-excited',
  dramatic: 'tone-dramatic',
  funny: 'tone-funny',
  neutral: 'tone-neutral',
  celebratory: 'tone-celebratory',
};

interface Props {
  /** 'local' reads the commentary bridge; 'online' reads the room store. */
  source?: 'local' | 'online';
}

/**
 * Live AI commentator panel. Shows one message at a time for ~4s, queues up to
 * 3 messages (dropping the oldest when full), and offers an optional text-to-
 * speech toggle that is off by default. Readable without sound via an ARIA
 * live region.
 */
export default function CommentatorPanel({ source = 'local' }: Props) {
  const isOnline = source === 'online';
  const localInbox = useCommentary((s) => s.items);
  const localEnabled = useCommentary((s) => s.enabled);
  const localConnected = useCommentary((s) => s.connected);
  const localLanguage = useCommentary((s) => s.language);
  const onlineInbox = useGame((s) => s.commentary);
  const onlineEnabled = useGame((s) => s.commentaryEnabled);
  const onlineConnected = useGame((s) => s.connected);
  const onlineLanguage = useGame((s) => s.commentaryLanguage);

  const commentary = isOnline ? onlineInbox : localInbox;
  const enabled = isOnline ? onlineEnabled : localEnabled;
  const connected = isOnline ? onlineConnected : localConnected;
  const language = isOnline ? onlineLanguage : localLanguage;
  const consume = isOnline ? consumeOnlineCommentary : consumeBridgeCommentary;

  const [queue, setQueue] = useState<CommentaryUpdate[]>([]);
  const [current, setCurrent] = useState<CommentaryUpdate | null>(null);
  const [ttsOn, setTtsOn] = useState(true);
  const spokenFor = useRef<string | null>(null);
  const speakTimer = useRef<number | null>(null);

  const voiceLang = (value: string): string => {
    const lang = value.toLowerCase();
    if (lang.includes('hind')) return 'hi-IN';
    if (lang.includes('arab')) return 'ar-SA';
    return 'en-US';
  };

  const speak = (message: string, isWinner: boolean): void => {
    const synth = window.speechSynthesis;
    // Cancel any stuck/busy speech so the next message always plays.
    synth.cancel();
    // Chrome drops utterances started immediately after cancel(); delay briefly.
    if (speakTimer.current !== null) window.clearTimeout(speakTimer.current);
    speakTimer.current = window.setTimeout(() => {
      const speakable = message
        .replace(/!{2,}/g, '!')
        .replace(/!/g, '.')
        .replace(/\.{3,}/g, '.')
        .trim();
      const utterance = new SpeechSynthesisUtterance(speakable);
      utterance.lang = voiceLang(language);
      utterance.volume = isWinner ? 1 : 0.9;
      utterance.rate = isWinner ? 0.95 : 1;
      utterance.pitch = isWinner ? 1.15 : 1;
      synth.speak(utterance);
    }, 120);
  };

  useEffect(() => {
    if (commentary.length === 0) return;
    const fresh = consume();
    if (fresh.length > 0) {
      setQueue((q) => [...q, ...fresh].slice(-MAX_QUEUE));
    }
  }, [commentary]);

  // Show the next queued message whenever nothing is currently displayed.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  // Auto-hide the current message after ~4s (separate effect so its timer is
  // not cleared by the advance effect's re-render).
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setCurrent(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (!ttsOn || !current || spokenFor.current === current.message) return;
    spokenFor.current = current.message;
    speak(current.message, current.type === 'MATCH_END');
  }, [current, ttsOn, language]);

  // Chrome pauses speech synthesis after a while / when the tab is backgrounded;
  // periodically nudge it back to life so commentary keeps speaking.
  useEffect(() => {
    if (!ttsOn) return;
    const id = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
    }, 8000);
    return () => {
      window.clearInterval(id);
      if (speakTimer.current !== null) window.clearTimeout(speakTimer.current);
    };
  }, [ttsOn]);

  if (!enabled) return null;

  const toneClass = current ? TONE_CLASS[current.tone] ?? '' : '';
  const isWinnerMsg = current?.type === 'MATCH_END';
  const idleText = connected
    ? 'Waiting for the action...'
    : 'Commentary offline — is the server running? (npm run dev:server)';

  return (
    <div className="commentator-panel" role="status" aria-live="polite">
      <div className="commentator-icon" aria-hidden="true">🎙️</div>
      <div
        className={`commentator-bubble ${toneClass} ${current ? 'enter' : ''} ${!connected ? 'offline' : ''} ${isWinnerMsg ? 'winner' : ''}`}
      >
        {connected && <span className="live-badge">LIVE</span>}
        {isWinnerMsg && <span className="winner-badge">🏆 WINNER</span>}
        {current ? current.message : idleText}
      </div>
      <button
        type="button"
        className={`tts-toggle ${ttsOn ? 'active' : ''}`}
        aria-pressed={ttsOn}
        title={ttsOn ? 'Mute commentary sound' : 'Enable commentary sound'}
        onClick={() => setTtsOn((v) => !v)}
      >
        {ttsOn ? '🔊' : '🔇'}
      </button>
    </div>
  );
}