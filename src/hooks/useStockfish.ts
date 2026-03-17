import { useRef, useCallback, useEffect } from 'react';

interface StockfishOptions {
  skillLevel: number;
  moveTimeMs?: number;
}

export function useStockfish({ skillLevel, moveTimeMs = 1000 }: StockfishOptions) {
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((move: string) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker('/stockfish.wasm.js');
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        if (move && resolveRef.current) {
          resolveRef.current(move);
          resolveRef.current = null;
        }
      }
    };

    // Initialize UCI
    worker.postMessage('uci');

    return () => {
      worker.postMessage('quit');
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const getBestMove = useCallback(
    (fen: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error('Stockfish not initialized'));
          return;
        }
        resolveRef.current = resolve;
        worker.postMessage('isready');
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go movetime ${moveTimeMs}`);
      });
    },
    [skillLevel, moveTimeMs]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
  }, []);

  return { getBestMove, stop };
}
