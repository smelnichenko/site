import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameState, spinGame, resetGame, SpinResult } from '../services/api';

interface GameState {
  player1Position: number;
  player2Position: number;
  currentTurn: number;
  totalSpins: number;
  completed: boolean;
  winner: number | null;
}

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [godotReady, setGodotReady] = useState(false);

  const sendToGodot = useCallback((type: string, data: unknown) => {
    // postMessage → HTML listener → _godotReceive(json) → GDScript callback
    iframeRef.current?.contentWindow?.postMessage({ type, data }, '*');
  }, []);

  // Poll for Godot ready (_godotReceive is registered by WASM _ready())
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const win = iframeRef.current?.contentWindow as Window & { _godotReceive?: unknown };
        if (win?._godotReceive) {
          setGodotReady(true);
          clearInterval(interval);
        }
      } catch {
        // not ready yet
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Load initial state
  useEffect(() => {
    fetchGameState()
      .then(s => {
        setState(s);
      })
      .catch(err => setError(String(err)));
  }, []);

  // Send state to Godot when ready
  useEffect(() => {
    if (godotReady && state) {
      sendToGodot('state', state);
    }
  }, [godotReady, state, sendToGodot]);

  const handleSpin = async () => {
    if (spinning || !state || state.completed) return;
    setSpinning(true);
    try {
      const result: SpinResult = await spinGame();
      sendToGodot('spinResult', result);
      // Wait for animation before updating React state
      setTimeout(() => {
        setState({
          player1Position: result.player1Position,
          player2Position: result.player2Position,
          currentTurn: result.currentTurn,
          totalSpins: result.totalSpins,
          completed: result.completed,
          winner: result.winner || null,
        });
        setSpinning(false);
      }, 2000);
    } catch (err) {
      setError(String(err));
      setSpinning(false);
    }
  };

  const handleReset = async () => {
    try {
      const s = await resetGame();
      setState(s);
      sendToGodot('state', s);
    } catch (err) {
      setError(String(err));
    }
  };

  const turnText = state
    ? state.completed
      ? `Player ${state.winner} Wins!`
      : `Player ${state.currentTurn}'s Turn`
    : 'Loading...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '12px 8px', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{turnText}</span>
        <button
          className="btn-primary"
          onClick={handleSpin}
          disabled={spinning || !state || state.completed}
          style={{ padding: '8px 32px', fontSize: '16px' }}
        >
          {spinning ? 'Spinning...' : 'SPIN'}
        </button>
        <button
          onClick={handleReset}
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          Reset
        </button>
        {state && <span style={{ fontSize: '12px', color: '#888' }}>Spins: {state.totalSpins}</span>}
      </div>
      <iframe
        ref={iframeRef}
        src="/game/index.html"
        title="Slot Machine Board Game"
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          border: 'none',
          borderRadius: '8px',
          background: '#1a1a2e',
        }}
      />
      {error && <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '4px' }}>{error}</div>}
    </div>
  );
}
