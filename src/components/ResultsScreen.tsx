import type { MatchResult } from '../types/game';
import { useCommentary } from '../net/commentary';
import { PLAYER_CSS_COLORS } from '../utils/constants';

interface Props {
  result: MatchResult;
  player1Name: string;
  player2Name: string;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export default function ResultsScreen({
  result,
  player1Name,
  player2Name,
  onPlayAgain,
  onMenu,
}: Props) {
  const recap = useCommentary((s) => s.recap);
  const winnerLabel = result.winner === null
    ? "It's a Draw!"
    : `${result.winner === 1 ? player1Name : player2Name} Wins!`;

  const winnerColor = result.winner === null
    ? '#ffffff'
    : PLAYER_CSS_COLORS[result.winner];

  return (
    <div className="screen results-screen">
      <div className="results-panel">
        <h1 className="title winner-title" style={{ color: winnerColor }}>{winnerLabel}</h1>

        <div className="final-scores">
          <div className="final-score" style={{ borderColor: PLAYER_CSS_COLORS[1] }}>
            <span className="name" style={{ color: PLAYER_CSS_COLORS[1] }}>{player1Name}</span>
            <span className="score">{result.player1Score}</span>
          </div>
          <div className="vs">VS</div>
          <div className="final-score" style={{ borderColor: PLAYER_CSS_COLORS[2] }}>
            <span className="name" style={{ color: PLAYER_CSS_COLORS[2] }}>{player2Name}</span>
            <span className="score">{result.player2Score}</span>
          </div>
        </div>

        {recap && (
          <div className="final-recap" role="status" aria-live="polite">
            <span className="final-recap-icon" aria-hidden="true">🎙️</span>
            <p>{recap.message}</p>
          </div>
        )}

        <div className="start-actions">
          <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="btn btn-secondary" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}