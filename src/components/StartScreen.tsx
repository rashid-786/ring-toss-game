import { useState } from 'react';
import { INSTRUCTIONS_TEXT } from '../utils/constants';
import { initAudio } from '../utils/audio';
import { PLAYER_CSS_COLORS } from '../utils/constants';

export interface PlayerNames {
  player1Name: string;
  player2Name: string;
}

interface Props {
  onLocal: (names: PlayerNames) => void;
  onOnline: () => void;
}

export default function StartScreen({ onLocal, onOnline }: Props) {
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const name1 = player1Name.trim() || 'Player 1';
  const name2 = player2Name.trim() || 'Player 2';

  const start = () => {
    initAudio();
    onLocal({ player1Name: name1, player2Name: name2 });
  };

  return (
    <div className="screen start-screen">
      <div className="start-panel">
        <h1 className="title">Ring Toss Duel</h1>
        <p className="subtitle">Enter both names, then start the match.</p>

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

        <div className="start-actions">
          <button type="button" className="btn btn-primary" onClick={start}>
            Join &amp; Start
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowInstructions((v) => !v)}>
            Instructions
          </button>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onOnline}>
          Play Online
        </button>

        {showInstructions && (
          <div className="instructions">
            <p>{INSTRUCTIONS_TEXT}</p>
            <ul>
              <li>Drag the ring backward, then release to throw.</li>
              <li>Players take turns; each has 5 attempts.</li>
              <li>A tie after 5 attempts leads to sudden-death rounds.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}