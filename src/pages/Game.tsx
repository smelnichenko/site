import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameState, spinGame, resetGame } from '../services/api';

// Shape of the messages Godot posts back to the host (via postMessage or CustomEvent).
interface GodotMessage {
  source?: string;
  type?: string;
}

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
    } catch {
      /* iframe not ready */
    }
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
      } catch {
        /* not ready */
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Load and send initial state when Godot is ready
  useEffect(() => {
    if (!godotReady) return;
    fetchGameState()
      .then((s) => sendToGodot('state', s))
      .catch((err) => setError(String(err)));
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

    // postMessage handler (new Godot exports). MessageEvent.data is typed `any`,
    // so narrow it to the known payload shape before touching fields.
    const messageHandler = (e: MessageEvent) => {
      if (e.origin !== globalThis.location.origin) return; // the game is served by this site; nothing else may drive it
      const data = e.data as GodotMessage | null;
      // handleGodotAction owns its own try/catch, so its promise never rejects;
      // void-ing it satisfies the void-returning listener contract.
      if (data?.source === 'godot' && data.type) void handleGodotAction(data.type);
    };

    // CustomEvent handler (old Godot exports dispatch on iframe window)
    const customEventHandler = (e: Event) => {
      const detail = (e as CustomEvent<GodotMessage>).detail;
      if (detail?.source === 'godot' && detail.type) void handleGodotAction(detail.type);
    };

    // Capture the ref so add and remove target the same window even if the ref changes.
    const iframeWindow = iframeRef.current?.contentWindow;
    globalThis.addEventListener('message', messageHandler);
    try {
      iframeWindow?.addEventListener('godotMessage', customEventHandler);
    } catch {
      /* cross-origin */
    }

    return () => {
      globalThis.removeEventListener('message', messageHandler);
      try {
        iframeWindow?.removeEventListener('godotMessage', customEventHandler);
      } catch {
        /* already cleaned */
      }
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
      {error && (
        <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '4px' }}>{error}</div>
      )}
    </div>
  );
}
