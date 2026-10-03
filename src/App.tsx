import { useState } from 'react';
import StartScreen, { type PlayerNames } from './components/StartScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import OnlineGameScreen from './components/OnlineGameScreen';
import ResultsScreen from './components/ResultsScreen';
import {
  useGame,
  connectGame,
  disconnectGame,
  leaveRoom,
  rematch,
  resetStore,
} from './net/gameStore';
import type { MatchResult } from './types/game';

type Mode = 'local' | 'online' | null;
type Screen = 'start' | 'lobby' | 'game' | 'results';

export default function App() {
  const [mode, setMode] = useState<Mode>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [matchId, setMatchId] = useState(0);
  const [names, setNames] = useState<PlayerNames>({ player1Name: 'Player 1', player2Name: 'Player 2' });
  const [onlineName, setOnlineName] = useState('');

  const phase = useGame((s) => s.phase);
  const room = useGame((s) => s.room);

  // Online uses the actual room player names; local uses the entered names.
  const resultPlayer1Name = mode === 'online'
    ? room?.players.find((p) => p.playerId === 1)?.name ?? names.player1Name
    : names.player1Name;
  const resultPlayer2Name = mode === 'online'
    ? room?.players.find((p) => p.playerId === 2)?.name ?? names.player2Name
    : names.player2Name;

  const goLocal = (entered: PlayerNames) => {
    setNames(entered);
    setMode('local');
    setMatchId((m) => m + 1);
    setScreen('game');
  };

  const goOnline = (name: string) => {
    setOnlineName(name.trim() || 'Player 1');
    setMode('online');
    connectGame();
    setScreen('lobby');
  };

  const handleOnlineStart = () => {
    setMatchId((m) => m + 1);
    setScreen('game');
  };

  const handleGameComplete = (r: MatchResult) => {
    setResult(r);
    setScreen('results');
  };

  const handleOnlineAbort = () => {
    setScreen('lobby');
  };

  const playAgain = () => {
    if (mode === 'local') {
      setMatchId((m) => m + 1);
      setScreen('game');
    } else {
      rematch();
      setScreen('lobby');
    }
  };

  const goMenu = () => {
    if (mode === 'online') {
      leaveRoom();
      disconnectGame();
      resetStore();
    }
    setMode(null);
    setResult(null);
    setScreen('start');
  };

  return (
    <div className="app">
      {screen === 'start' && (
        <StartScreen onLocal={goLocal} onOnline={goOnline} />
      )}

      {screen === 'lobby' && mode === 'online' && (
        <LobbyScreen
          initialName={onlineName}
          onStart={handleOnlineStart}
          onBack={goMenu}
        />
      )}

      {screen === 'game' && mode === 'local' && (
        <GameScreen
          key={matchId}
          player1Name={names.player1Name}
          player2Name={names.player2Name}
          onComplete={handleGameComplete}
        />
      )}

      {screen === 'game' && mode === 'online' && phase !== 'idle' && (
        <OnlineGameScreen
          key={matchId}
          onComplete={handleGameComplete}
          onAbort={handleOnlineAbort}
        />
      )}

      {screen === 'results' && result && (
        <ResultsScreen
          result={result}
          player1Name={resultPlayer1Name}
          player2Name={resultPlayer2Name}
          onPlayAgain={playAgain}
          onMenu={goMenu}
        />
      )}
    </div>
  );
}