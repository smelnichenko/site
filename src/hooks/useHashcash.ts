import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';

interface CaptchaConfig {
  enabled: boolean;
}

interface ChallengeResponse {
  challenge: string;
  difficulty: number;
}

interface HashcashResult {
  challenge: string;
  nonce: string;
}

interface UseHashcashReturn {
  /** Whether captcha is enabled on the server */
  enabled: boolean;
  /** Whether the worker is currently solving */
  solving: boolean;
  /** Solve a challenge and return the result. Call before form submission. */
  solve: () => Promise<HashcashResult>;
}

export function useHashcash(): UseHashcashReturn {
  const [enabled, setEnabled] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    fetch('/api/captcha/config')
      .then(res => res.json())
      .then((config: CaptchaConfig) => setEnabled(config.enabled))
      .catch(() => setEnabled(false));
  }, []);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const [solving, setSolving] = useState(false);

  const solve = useCallback(async (): Promise<HashcashResult> => {
    if (!enabled) {
      return { challenge: '', nonce: '' };
    }

    setSolving(true);
    try {
      // Fetch challenge from server
      const res = await fetch('/api/captcha/challenge');
      if (!res.ok) {
        throw new Error('Failed to get captcha challenge');
      }
      const { challenge, difficulty } = (await res.json()) as ChallengeResponse;

      // Solve in Web Worker
      const nonce = await solveInWorker(workerRef, challenge, difficulty);
      return { challenge, nonce };
    } finally {
      setSolving(false);
    }
  }, [enabled]);

  return { enabled, solving, solve };
}

// Kept at module scope so it holds a stable identity across renders. When this
// lived inside the component, the `solve` useCallback closed over a fresh copy
// each render without listing it as a dependency, which made the memoization
// unsound and prevented the React Compiler from preserving it.
function solveInWorker(
  workerRef: RefObject<Worker | null>,
  challenge: string,
  difficulty: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Terminate any previous worker
    workerRef.current?.terminate();

    const worker = new Worker(
      new URL('../workers/hashcash.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ nonce: string; iterations: number }>) => {
      worker.terminate();
      workerRef.current = null;
      resolve(event.data.nonce);
    };

    worker.onerror = (error) => {
      worker.terminate();
      workerRef.current = null;
      reject(new Error(`Worker error: ${error.message}`));
    };

    worker.postMessage({ challenge, difficulty });
  });
}
