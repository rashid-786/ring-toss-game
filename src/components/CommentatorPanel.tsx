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
  const onlineInbox = useGame((s) => s.commentary);
  const onlineEnabled = useGame((s) => s.commentaryEnabled);
  const onlineConnected = useGame((s) => s.connected);

  const commentary = isOnline ? onlineInbox : localInbox;
  const enabled = isOnline ? onlineEnabled : localEnabled;
  const connected = isOnline ? onlineConnected : localConnected;
  const consume = isOnline ? consumeOnlineCommentary : consumeBridgeCommentary;

  const [queue, setQueue] = useState<CommentaryUpdate[]>([]);
  const [current, setCurrent] = useState<CommentaryUpdate | null>(null);
  const [ttsOn, setTtsOn] = useState(false);
  const spokenFor = useRef<string | null>(null);

  useEffect(() => {
    if (commentary.length === 0) return;
    const fresh = consume();
    if (fresh.length > 0) {
      setQueue((q) => [...q, ...fresh].slice(-MAX_QUEUE));
    }
  }, [commentary]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    const timer = window.setTimeout(() => setCurrent(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [current, queue]);

  useEffect(() => {
    if (!ttsOn || !current || spokenFor.current === current.message) return;
    spokenFor.current = current.message;
    try {
      const utterance = new SpeechSynthesisUtterance(current.message);
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech synthesis unavailable — commentary stays visible as text
    }
  }, [current, ttsOn]);

  if (!enabled) return null;

  const toneClass = current ? TONE_CLASS[current.tone] ?? '' : '';
  const idleText = connected
    ? 'Waiting for the action...'
    : 'Commentary offline — is the server running? (npm run dev:server)';

  return (
    <div className="commentator-panel" role="status" aria-live="polite">
      <div className="commentator-icon" aria-hidden="true">🎙️</div>
      <div className={`commentator-bubble ${toneClass} ${current ? 'enter' : ''} ${!connected ? 'offline' : ''}`}>
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