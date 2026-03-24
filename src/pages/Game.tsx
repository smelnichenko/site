import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameState, spinGame, resetGame } from '../services/api';

export default function Game() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [godotReady, setGodotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendToGodot = useCallback((type: string, data: unknown) => {
    try {
      const win = iframeRef.current?.contentWindow as Window & {
        _godotReceive?: (json: string) => void;
      };
      win?._godotReceive?.(JSON.stringify({ type, data }));
    } catch { /* iframe not ready */ }
  }, []);

  // Poll for Godot ready
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const win = iframeRef.current?.contentWindow as Window & { _gameReady?: boolean };
        if (win?._gameReady) {
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

  // Listen for messages from Godot (supports both postMessage and CustomEvent)
  useEffect(() => {
    const handleGodotAction = async (type: string) => {
      try {
        if (type === 'spin') {
          const result = await spinGame();
          sendToGodot('spinResult', result);
        } else if (type === 'reset') {
          const s = await resetGame();
          sendToGodot('state', s);
        }
      } catch (err) {
        setError(String(err));
        sendToGodot('error', { message: String(err) });
      }
    };

    // postMessage handler (new Godot exports)
    const messageHandler = (e: MessageEvent) => {
      if (e.data?.source === 'godot') handleGodotAction(e.data.type);
    };

    // CustomEvent handler (old Godot exports dispatch on iframe window)
    const customEventHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.source === 'godot') handleGodotAction(detail.type);
    };

    globalThis.addEventListener('message', messageHandler);
    try {
      iframeRef.current?.contentWindow?.addEventListener('godotMessage', customEventHandler);
    } catch { /* cross-origin */ }

    return () => {
      globalThis.removeEventListener('message', messageHandler);
      try {
        iframeRef.current?.contentWindow?.removeEventListener('godotMessage', customEventHandler);
      } catch { /* already cleaned */ }
    };
  }, [godotReady, sendToGodot]);

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
