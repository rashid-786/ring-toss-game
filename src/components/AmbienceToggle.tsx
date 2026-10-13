import { useState } from 'react';
import { isAmbienceMuted, setAmbienceMuted } from '../utils/audio';

export default function AmbienceToggle() {
  const [muted, setMuted] = useState(isAmbienceMuted());

  return (
    <button
      type="button"
      className={`ambience-toggle ${muted ? '' : 'active'}`}
      aria-pressed={!muted}
      title={muted ? 'Enable music & crowd sounds' : 'Mute music & crowd sounds'}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setAmbienceMuted(next);
      }}
    >
      {muted ? '🔇🎵' : '🎵'}
    </button>
  );
}