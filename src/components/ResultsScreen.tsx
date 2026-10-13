import { useEffect, useMemo } from 'react';
import type { MatchResult } from '../types/game';
import { useCommentary } from '../net/commentary';
import { useGame } from '../net/gameStore';
import { PLAYER_CSS_COLORS } from '../utils/constants';
import { playCheer, speakText } from '../utils/audio';

interface Props {
  result: MatchResult;
  player1Name: string;
  player2Name: string;
  onPlayAgain: () => void;
  onMenu: () => void;
}

const CONFETTI_COLORS = [
  '#ffd54f', '#ff8a65', '#4dd0e1', '#69f0ae',
  '#7986cb', '#ff5252', '#fff176', '#f48fb1',
];

function voiceLang(value: string): string {
  const lang = value.toLowerCase();
  if (lang.includes('hind')) return 'hi-IN';
  if (lang.includes('arab')) return 'ar-SA';
  return 'en-US';
}

export default function ResultsScreen({
  result,
  player1Name,
  player2Name,
  onPlayAgain,
  onMenu,
}: Props) {
  const localLanguage = useCommentary((s) => s.language);
  const onlineLanguage = useGame((s) => s.commentaryLanguage);
  const language = onlineLanguage || localLanguage;
  const localRecap = useCommentary((s) => s.recap);
  const onlineRecap = useGame((s) => s.recap);
  const recap = onlineRecap ?? localRecap;

  const hasWinner = result.winner !== null;
  const winnerName = hasWinner ? (result.winner === 1 ? player1Name : player2Name) : null;
  const winnerLabel = hasWinner ? `${winnerName} Wins!` : "It's a Draw!";
  const winnerColor = hasWinner ? PLAYER_CSS_COLORS[result.winner as 1 | 2] : '#ffffff';

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 17 + 7) % 100,
        delay: (i % 12) * 0.4,
        duration: 3 + (i % 6) * 0.9,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: 6 + (i % 4) * 3,
        height: (6 + (i % 4) * 3) * 1.7,
        rotate: (i * 47) % 360,
      })),
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      const text = hasWinner ? `And the winner is ${winnerName}!` : `It's a draw!`;
      speakText(text, voiceLang(language), { volume: 1, rate: 0.85, pitch: 1.2 });
      if (hasWinner) playCheer(1.6);
    }, 350);
    return () => window.clearTimeout(t);
  }, [hasWinner, winnerName, language]);

  return (
    <div className="screen results-screen">
      {hasWinner && (
        <div className="confetti-rain" aria-hidden="true">
          {confetti.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${p.left}%`,
                width: p.width,
                height: p.height,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotate}deg)`,
              }}
            />
          ))}
        </div>
      )}

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