import { useState, useEffect, useRef } from 'react';
import { fetchGameState, spinGame, resetGame, SpinResult } from '../services/api';

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  const sendToGodot = (type: string, data: unknown) => {
    const win = iframeRef.current?.contentWindow as Window & { _gameInbox?: unknown };
    if (win) {
      win._gameInbox = { type, data };
    }
  };

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.source !== 'godot') return;

      if (e.data.type === 'ready') {
        try {
          const s = await fetchGameState();
          sendToGodot('state', s);
        } catch (err) {
          setError(String(err));
        }
      } else if (e.data.type === 'spin') {
        try {
          const result: SpinResult = await spinGame();
          sendToGodot('spinResult', result);
        } catch (err) {
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
    </div>
  );
}
