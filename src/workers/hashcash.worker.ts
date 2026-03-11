/**
 * Web Worker for Hashcash proof-of-work computation.
 * Runs SHA-256 hashing off the main thread to avoid blocking the UI.
 */

interface SolveRequest {
  challenge: string;
  difficulty: number;
}

interface SolveResponse {
  nonce: string;
  iterations: number;
}

function hasLeadingZeroBits(hash: Uint8Array, requiredBits: number): boolean {
  const fullBytes = Math.floor(requiredBits / 8);
  const remainingBits = requiredBits % 8;

  for (let i = 0; i < fullBytes; i++) {
    if (hash[i] !== 0) return false;
  }

  if (remainingBits > 0 && fullBytes < hash.length) {
    const mask = (0xff << (8 - remainingBits)) & 0xff;
    if ((hash[fullBytes] & mask) !== 0) return false;
  }

  return true;
}

async function solve(challenge: string, difficulty: number): Promise<SolveResponse> {
  const encoder = new TextEncoder();
  let nonce = 0;

  while (true) {
    const input = `${challenge}:${nonce}`;
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hash = new Uint8Array(hashBuffer);

    if (hasLeadingZeroBits(hash, difficulty)) {
      return { nonce: String(nonce), iterations: nonce + 1 };
    }

    nonce++;

    // Yield to message loop periodically so worker can be terminated
    if (nonce % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

self.onmessage = async (event: MessageEvent<SolveRequest>) => {
  const { challenge, difficulty } = event.data;
  const result = await solve(challenge, difficulty);
  self.postMessage(result);
};
