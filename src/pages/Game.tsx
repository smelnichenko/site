import { useState, useEffect, useRef } from 'react';
import { fetchGameState, spinGame, resetGame, SpinResult } from '../services/api';

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  const log = (msg: string) => {
    setDebug(prev => [...prev.slice(-9), msg]);
  };

  const sendToGodot = (type: string, data: unknown) => {
    try {
      const win = iframeRef.current?.contentWindow as Window & { _gameInbox?: unknown };
      if (win) {
        win._gameInbox = { type, data };
        log(`→ Godot: ${type}`);
      } else {
        log(`→ Godot FAILED: no contentWindow`);
      }
    } catch (err) {
      log(`→ Godot ERROR: ${err}`);
    }
  };

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.source !== 'godot') return;
      log(`← Godot: ${e.data.type}`);

      if (e.data.type === 'ready') {
        try {
          const s = await fetchGameState();
          log(`API: got state (p1=${s.player1Position}, p2=${s.player2Position})`);
          sendToGodot('state', s);
        } catch (err) {
          log(`API ERROR: ${err}`);
          setError(String(err));
        }
      } else if (e.data.type === 'spin') {
        try {
          log('API: calling spin...');
          const result: SpinResult = await spinGame();
          log(`API: spin ok (colors=${result.colors})`);
          sendToGodot('spinResult', result);
        } catch (err) {
          log(`API SPIN ERROR: ${err}`);
          sendToGodot('spinError', { error: String(err) });
        }
      } else if (e.data.type === 'reset') {
        try {
          const s = await resetGame();
          sendToGodot('state', s);
        } catch (err) {
          setError(String(err));
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (error) {
    return <div className="card" style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <iframe
        ref={iframeRef}
        src="/game/index.html"
        title="Slot Machine Board Game"
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          borderRadius: '8px',
          background: '#1a1a2e',
        }}
      />
      <div style={{ padding: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#888', maxHeight: '120px', overflow: 'auto' }}>
        {debug.map((d, i) => <div key={i}>{d}</div>)}
      </div>
    </div>
  );
}
