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
    try {
      // Clean punctuation so voices don't read "!" as "exclamation point".
      const speakable = current.message
        .replace(/!{2,}/g, '!')
        .replace(/!/g, '.')
        .replace(/\.{3,}/g, '.')
        .trim();
      const synth = window.speechSynthesis;
      // Cancel any stuck/busy speech so the next message always plays.
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(speakable);
      const lang = language.toLowerCase();
      if (lang.includes('hind')) utterance.lang = 'hi-IN';
      else if (lang.includes('arab')) utterance.lang = 'ar-SA';
      else utterance.lang = 'en-US';
      synth.speak(utterance);
    } catch {
      // speech synthesis unavailable — commentary stays visible as text
    }
  }, [current, ttsOn, language]);

  if (!enabled) return null;

  const toneClass = current ? TONE_CLASS[current.tone] ?? '' : '';
  const idleText = connected
    ? 'Waiting for the action...'
    : 'Commentary offline — is the server running? (npm run dev:server)';

  return (
    <div className="commentator-panel" role="status" aria-live="polite">
      <div className="commentator-icon" aria-hidden="true">🎙️</div>
      <div className={`commentator-bubble ${toneClass} ${current ? 'enter' : ''} ${!connected ? 'offline' : ''}`}>
        {connected && <span className="live-badge">LIVE</span>}
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