import { useEffect, useRef, useState } from 'react';
import { createOnlineGame } from '../game/createOnlineGame';
import {
  useGame,
  clearGoFlash,
} from '../net/gameStore';
import CommentatorPanel from './CommentatorPanel';
import type { MatchResult, PlayerId } from '../types/game';
import { PLAYER_CSS_COLORS } from '../utils/constants';

interface Props {
  onComplete: (result: MatchResult) => void;
  onAbort: () => void;
}

export default function OnlineGameScreen({ onComplete, onAbort }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const snapshot = useGame((s) => s.snapshot);
  const phase = useGame((s) => s.phase);
  const result = useGame((s) => s.result);
  const abortMessage = useGame((s) => s.abortMessage);
  const goFlash = useGame((s) => s.goFlash);
  const myPlayerId = useGame((s) => s.myPlayerId);
  const connected = useGame((s) => s.connected);
  const room = useGame((s) => s.room);

  const player1Name = room?.players.find((p) => p.playerId === 1)?.name ?? 'Player 1';
  const player2Name = room?.players.find((p) => p.playerId === 2)?.name ?? 'Player 2';

  const [showGo, setShowGo] = useState(false);
  const [showAbort, setShowAbort] = useState(false);

  useEffect(() => {
    const game = createOnlineGame(containerRef.current!);
    return () => {
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (goFlash) {
      setShowGo(true);
      const t = window.setTimeout(() => {
        setShowGo(false);
        clearGoFlash();
      }, 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [goFlash]);

  useEffect(() => {
    if (phase === 'ended' && result) {
      const t = window.setTimeout(() => onCompleteRef.current(result), 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, result]);

  useEffect(() => {
    if (abortMessage) setShowAbort(true);
  }, [abortMessage]);

  const scores = snapshot?.scores ?? { 1: 0, 2: 0 };
  const attempts = snapshot?.attempts ?? { 1: 0, 2: 0 };
  const tieBreaker = snapshot?.tieBreaker ?? false;
  const tieBreakerRound = snapshot?.tieBreakerRound ?? 0;
  const turn: PlayerId = snapshot?.turn ?? 1;
  const countdown = snapshot?.countdownActive ? snapshot.countdown : null;

  const currentPlayerColor = PLAYER_CSS_COLORS[turn];

  return (
    <div className="screen game-screen">
      <div className="hud">
        <div className="score-box" style={{ borderColor: PLAYER_CSS_COLORS[1] }}>
          <span className="name" style={{ color: PLAYER_CSS_COLORS[1] }}>{player1Name}</span>
          <span className="score">{scores[1]}</span>
          <span className="attempts">
            {tieBreaker ? 'Sudden death' : `Attempt ${Math.min(attempts[1] + 1, 5)} / 5`}
          </span>
        </div>

        <div className="hud-center">
          <div className="turn-badge" style={{ background: currentPlayerColor }}>
            {turn === 1 ? player1Name : player2Name} Turn
          </div>
          {tieBreaker && (
            <div className="tiebreaker-badge">Sudden Death • Round {tieBreakerRound}</div>
          )}
        </div>

        <div className="score-box" style={{ borderColor: PLAYER_CSS_COLORS[2] }}>
          <span className="name" style={{ color: PLAYER_CSS_COLORS[2] }}>{player2Name}</span>
          <span className="score">{scores[2]}</span>
          <span className="attempts">
            {tieBreaker ? 'Sudden death' : `Attempt ${Math.min(attempts[2] + 1, 5)} / 5`}
          </span>
        </div>
      </div>

      <div className="game-canvas" ref={containerRef} />

      <CommentatorPanel source="online" />

      <div className="hint">
        {snapshot?.turn === myPlayerId
          ? 'Your turn drag the ring backward and release to throw'
          : 'Opponent is throwing watch and wait'}
      </div>

      {!connected && <div className="overlay-panel">Disconnected... reconnecting</div>}

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

      {showAbort && (
        <div className="overlay-panel">
          <h2>Match ended</h2>
          <p>{abortMessage}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowAbort(false);
              onAbort();
            }}
          >
            Back to Lobby
          </button>
        </div>
      )}
    </div>
  );
}
