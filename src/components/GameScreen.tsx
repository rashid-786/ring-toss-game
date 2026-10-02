import { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/createGame';
import { bus } from '../utils/events';
import { setCommentaryPlayers, connectCommentary, disconnectCommentary } from '../net/commentary';
import CommentatorPanel from './CommentatorPanel';
import type { MatchResult, PlayerId } from '../types/game';
import { PLAYER_CSS_COLORS } from '../utils/constants';

interface Props {
  player1Name: string;
  player2Name: string;
  onComplete: (result: MatchResult) => void;
}

export default function GameScreen({ player1Name, player2Name, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setCommentaryPlayers(player1Name, player2Name);
    connectCommentary();
    return () => {
      disconnectCommentary();
    };
  }, [player1Name, player2Name]);

  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerId>(1);
  const [attempts, setAttempts] = useState<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const [tieBreaker, setTieBreaker] = useState(false);
  const [tieBreakerRound, setTieBreakerRound] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);

  useEffect(() => {
    const offs = [
      bus.on('hud:countdown', ({ value, active }) => {
        if (active) {
          setShowGo(false);
          setCountdown(value);
        } else {
          setCountdown(null);
          setShowGo(true);
          window.setTimeout(() => setShowGo(false), 900);
        }
      }),
      bus.on('hud:turn', ({ playerId }) => setCurrentPlayer(playerId)),
      bus.on('hud:score', ({ playerId, score }) => {
        if (playerId === 1) setP1Score(score);
        else setP2Score(score);
      }),
      bus.on('hud:attempts', ({ attempts: a, tieBreaker: tb, tieBreakerRound: r }) => {
        setAttempts(a);
        setTieBreaker(tb);
        setTieBreakerRound(r);
      }),
      bus.on('hud:match-end', ({ result }) => {
        window.setTimeout(() => onCompleteRef.current(result), 900);
      }),
    ];

    const game = createGame(containerRef.current!);

    return () => {
      offs.forEach((off) => off());
      game.destroy(true);
    };
  }, []);

  const player1Color = PLAYER_CSS_COLORS[1];
  const player2Color = PLAYER_CSS_COLORS[2];

  return (
    <div className="screen game-screen">
      <div className="hud">
        <div className="score-box" style={{ borderColor: player1Color }}>
          <span className="name" style={{ color: player1Color }}>{player1Name}</span>
          <span className="score">{p1Score}</span>
          <span className="attempts">
            {tieBreaker ? 'Sudden death' : `Attempt ${Math.min(attempts[1] + 1, 5)} / 5`}
          </span>
        </div>

        <div className="hud-center">
          <div className="turn-badge" style={{ background: PLAYER_CSS_COLORS[currentPlayer] }}>
            {currentPlayer === 1 ? player1Name : player2Name} Turn
          </div>
          {tieBreaker && (
            <div className="tiebreaker-badge">Sudden Death • Round {tieBreakerRound}</div>
          )}
        </div>

        <div className="score-box" style={{ borderColor: player2Color }}>
          <span className="name" style={{ color: player2Color }}>{player2Name}</span>
          <span className="score">{p2Score}</span>
          <span className="attempts">
            {tieBreaker ? 'Sudden death' : `Attempt ${Math.min(attempts[2] + 1, 5)} / 5`}
          </span>
        </div>
      </div>

      <div className="game-canvas" ref={containerRef} />

      <CommentatorPanel />

      <div className="hint">Drag the ring backward and release to throw</div>

      {countdown !== null && (
        <div className="countdown-overlay">
          <span className="countdown-number">{countdown}</span>
        </div>
      )}
      {showGo && (
        <div className="countdown-overlay go">
          <span className="countdown-number">GO!</span>
        </div>
      )}
    </div>
  );
}