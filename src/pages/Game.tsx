import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameState, spinGame, resetGame } from '../services/api';

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [godotReady, setGodotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendToGodot = useCallback((type: string, data: unknown) => {
    iframeRef.current?.contentWindow?.postMessage({ type, data }, '*');
  }, []);

  // Poll for Godot ready
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const win = iframeRef.current?.contentWindow as Window & { _godotReceive?: unknown };
        if (win?._godotReceive) {
          setGodotReady(true);
          clearInterval(interval);
        }
      } catch { /* not ready */ }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Load and send initial state when Godot is ready
  useEffect(() => {
    if (!godotReady) return;
    fetchGameState()
      .then(s => sendToGodot('state', s))
      .catch(err => setError(String(err)));
  }, [godotReady, sendToGodot]);

  // Listen for messages from Godot (spin/reset requests)
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.source !== 'godot') return;
      try {
        if (e.data.type === 'spin') {
          const result = await spinGame();
          sendToGodot('spinResult', result);
        } else if (e.data.type === 'reset') {
          const s = await resetGame();
          sendToGodot('state', s);
        }
      } catch (err) {
        setError(String(err));
        sendToGodot('error', { message: String(err) });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToGodot]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
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
