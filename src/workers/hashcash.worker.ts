/**
 * Web Worker for Hashcash proof-of-work computation.
 * Runs SHA-256 hashing off the main thread to avoid blocking the UI.
 */

import { solve, SolveRequest } from './hashcash';

globalThis.onmessage = async (event: MessageEvent<SolveRequest>) => {
  const { challenge, difficulty } = event.data;
  const result = await solve(challenge, difficulty);
  globalThis.postMessage(result);
};
