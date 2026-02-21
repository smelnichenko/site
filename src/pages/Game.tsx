import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameState, spinGame, resetGame, GameState, SpinResult } from '../services/api';

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [godotReady, setGodotReady] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendToGodot = useCallback((type: string, data: unknown) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'react', type, data }, '*');
  }, []);

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.source !== 'godot') return;

      if (e.data.type === 'ready') {
        setGodotReady(true);
        try {
          const s = await fetchGameState();
          setState(s);
          sendToGodot('state', s);
        } catch (err) {
          setError(String(err));
        }
      } else if (e.data.type === 'spin') {
        try {
          const result: SpinResult = await spinGame();
          setState({
            id: state?.id ?? 0,
            player1Position: result.player1Position,
            player2Position: result.player2Position,
            currentTurn: result.currentTurn,
            totalSpins: result.totalSpins,
            completed: result.completed,
            winner: result.winner || null,
          });
          sendToGodot('spinResult', result);
        } catch (err) {
          sendToGodot('spinError', { error: String(err) });
        }
      } else if (e.data.type === 'reset') {
        try {
          const s = await resetGame();
          setState(s);
          sendToGodot('state', s);
        } catch (err) {
          setError(String(err));
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [state, sendToGodot]);

  // Fallback: if Godot doesn't load after 2s, try sending state anyway
  useEffect(() => {
    if (godotReady && state) {
      sendToGodot('state', state);
    }
  }, [godotReady, state, sendToGodot]);

  if (error) {
    return <div className="card" style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <iframe
        ref={iframeRef}
        src="/game/index.html"
        title="Slot Machine Board Game"
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          borderRadius: '8px',
          background: '#1a1a2e',
        }}
      />
    </div>
  );
}
