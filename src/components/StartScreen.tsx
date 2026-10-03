import { useState } from 'react';
import { INSTRUCTIONS_TEXT } from '../utils/constants';
import { initAudio, primeSpeech } from '../utils/audio';
import { PLAYER_CSS_COLORS } from '../utils/constants';

export interface PlayerNames {
  player1Name: string;
  player2Name: string;
}

interface Props {
  onLocal: (names: PlayerNames) => void;
  onOnline: (name: string) => void;
}

/** Local same-device mode is opt-in via VITE_LOCAL_GAME_ENABLED in .env. */
const LOCAL_GAME_ENABLED = import.meta.env.VITE_LOCAL_GAME_ENABLED === 'true';

export default function StartScreen({ onLocal, onOnline }: Props) {
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const name1 = player1Name.trim() || 'Player 1';
  const name2 = player2Name.trim() || 'Player 2';
  // Online uses the name you typed (either field works — each player is on
  // their own device, so they enter their own name).
  const onlineName = player1Name.trim() || player2Name.trim() || 'Player 1';

  const start = () => {
    initAudio();
    primeSpeech();
    onLocal({ player1Name: name1, player2Name: name2 });
  };

  return (
    <div className="screen start-screen">
      <div className="start-panel">
        <h1 className="title">Lets Begin !!</h1>
        <p className="subtitle">E-Com Online Ring Toss Tournament</p>

        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => {
            initAudio();
            primeSpeech();
            onOnline(onlineName);
          }}
        >
          ▶ Play Online
        </button>

        {LOCAL_GAME_ENABLED && (
          <>
            <div className="or-divider"><span>or play locally on this device</span></div>

            <div className="lobby-form player-names">
              <label htmlFor="player1-name" style={{ color: PLAYER_CSS_COLORS[1] }}>
                Player 1 name
              </label>
              <input
                id="player1-name"
                type="text"
                value={player1Name}
                maxLength={20}
                placeholder="Player 1"
                onChange={(e) => setPlayer1Name(e.target.value)}
              />
              <label htmlFor="player2-name" style={{ color: PLAYER_CSS_COLORS[2] }}>
                Player 2 name
              </label>
              <input
                id="player2-name"
                type="text"
                value={player2Name}
                maxLength={20}
                placeholder="Player 2"
                onChange={(e) => setPlayer2Name(e.target.value)}
              />
            </div>

            <button type="button" className="btn btn-secondary" onClick={start}>
              Join &amp; Start (Local)
            </button>
          </>
        )}

        <button type="button" className="btn btn-secondary" onClick={() => setShowInstructions((v) => !v)}>
          Instructions
        </button>

        {showInstructions && (
          <div className="instructions">
            <p>{INSTRUCTIONS_TEXT}</p>
            <ul>
              <li>Play Online: one player creates a room, the other joins with the 6-character code.</li>
              <li>Drag the ring backward, then release to throw.</li>
              <li>Player 1 throws all 5 attempts, then Player 2 throws all 5.</li>
              <li>A tie after 5 attempts leads to sudden-death rounds.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
