import { useEffect, useState } from 'react';
import { useGame, createRoom, joinRoom, startMatch } from '../net/gameStore';
import { PLAYER_1_NAME, PLAYER_2_NAME, PLAYER_CSS_COLORS } from '../utils/constants';

interface Props {
  onStart: () => void;
  onBack: () => void;
}

export default function LobbyScreen({ onStart, onBack }: Props) {
  const room = useGame((s) => s.room);
  const myPlayerId = useGame((s) => s.myPlayerId);
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);
  const connected = useGame((s) => s.connected);

  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (phase !== 'idle') onStart();
  }, [phase, onStart]);

  if (room) {
    const waiting = room.players.length < 2;
    return (
      <div className="screen lobby-screen">
        <div className="lobby-panel">
          <h1 className="title lobby-title">Room</h1>
          <div className="room-code-box">
            <span className="room-code">{room.roomCode}</span>
            <span className="room-code-label">Room code</span>
          </div>

          <div className="lobby-players">
            {room.players.map((p) => (
              <div
                key={p.playerId}
                className="lobby-player"
                style={{ borderColor: PLAYER_CSS_COLORS[p.playerId as 1 | 2] }}
              >
                <span className="lobby-player-name" style={{ color: PLAYER_CSS_COLORS[p.playerId as 1 | 2] }}>
                  {p.playerId === 1 ? PLAYER_1_NAME : PLAYER_2_NAME}
                  {p.playerId === myPlayerId ? ' (you)' : ''}: {p.name}
                </span>
                {isHost && p.playerId === 1 && <span className="lobby-host">host</span>}
              </div>
            ))}
            {waiting && <div className="lobby-player waiting">Waiting for opponent...</div>}
          </div>

          {isHost ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={waiting}
              onClick={() => startMatch()}
            >
              {waiting ? 'Waiting for opponent' : 'Start Match'}
            </button>
          ) : (
            <p className="lobby-note">Waiting for the host to start the match...</p>
          )}

          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen lobby-screen">
      <div className="lobby-panel">
        <h1 className="title lobby-title">Play Online</h1>
        {error && <div className="lobby-error">{error}</div>}
        {!connected && <p className="lobby-note">Connecting...</p>}

        <div className="lobby-form">
          <label htmlFor="online-name">Your name</label>
          <input
            id="online-name"
            type="text"
            value={name}
            maxLength={20}
            placeholder="Player"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {mode === null && (
          <div className="start-actions">
            <button type="button" className="btn btn-primary" onClick={() => setMode('create')}>
              Create Room
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode('join')}>
              Join Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="start-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => createRoom(name.trim() || 'Player 1')}
            >
              Create &amp; Wait
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="lobby-form">
            <label htmlFor="room-code-input">Room code</label>
            <input
              id="room-code-input"
              type="text"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="ABC123"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <div className="start-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={code.trim().length !== 6}
                onClick={() => joinRoom(code.trim(), name.trim() || 'Player 2')}
              >
                Join
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>
                Back
              </button>
            </div>
          </div>
        )}

        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Main Menu
        </button>
      </div>
    </div>
  );
}