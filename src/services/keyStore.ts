// In-memory key store for E2E encryption
// Cleared on logout — no persistent browser storage

let identityPrivateKey: CryptoKey | null = null;
let identityPublicKey: CryptoKey | null = null;

// channelId -> keyVersion -> CryptoKey
const channelKeys = new Map<number, Map<number, CryptoKey>>();

export function setIdentityKeys(privateKey: CryptoKey, publicKey: CryptoKey) {
  identityPrivateKey = privateKey;
  identityPublicKey = publicKey;
}

export function getIdentityPrivateKey(): CryptoKey | null {
  return identityPrivateKey;
}

export function getIdentityPublicKey(): CryptoKey | null {
  return identityPublicKey;
}

export function hasIdentityKeys(): boolean {
  return identityPrivateKey !== null && identityPublicKey !== null;
}

export function setChannelKey(channelId: number, keyVersion: number, key: CryptoKey) {
  if (!channelKeys.has(channelId)) {
    channelKeys.set(channelId, new Map());
  }
  channelKeys.get(channelId)!.set(keyVersion, key);
}

export function getChannelKey(channelId: number, keyVersion: number): CryptoKey | null {
  return channelKeys.get(channelId)?.get(keyVersion) ?? null;
}

export function getLatestChannelKey(channelId: number): CryptoKey | null {
  const versions = channelKeys.get(channelId);
  if (!versions || versions.size === 0) return null;
  const maxVersion = Math.max(...versions.keys());
  return versions.get(maxVersion) ?? null;
}

export function removeChannelKeys(channelId: number) {
  channelKeys.delete(channelId);
}

export function clear() {
  identityPrivateKey = null;
  identityPublicKey = null;
  channelKeys.clear();
}
