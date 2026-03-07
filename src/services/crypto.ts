// E2E Encryption using Web Crypto API
// ECDH P-256 for key exchange, AES-256-GCM for symmetric encryption

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const AES_PARAMS = { name: 'AES-GCM', length: 256 };
const PBKDF2_HASH = 'SHA-256';

// --- Identity Key Pair (ECDH P-256) ---

export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits']);
}

export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, []);
}

export async function exportPrivateKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('pkcs8', key);
}

export async function importPrivateKey(pkcs8: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH_PARAMS, true, ['deriveKey', 'deriveBits']);
}

// --- PBKDF2 Wrapping Key (from password) ---

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveWrappingKey(
  password: string,
  salt: ArrayBuffer,
  iterations: number
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    AES_PARAMS,
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Private Key Encrypt/Decrypt (with password-derived key) ---

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<string> {
  const pkcs8 = await exportPrivateKey(privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    pkcs8
  );
  // Concatenate iv + ciphertext, return as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToBase64(combined);
}

export async function decryptPrivateKey(
  encrypted: string,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const combined = base64ToBuffer(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext
  );
  return importPrivateKey(pkcs8);
}

// --- Channel Key (AES-256-GCM) ---

export async function generateChannelKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_PARAMS, true, ['encrypt', 'decrypt']);
}

export async function exportChannelKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importChannelKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, AES_PARAMS, true, ['encrypt', 'decrypt']);
}

// --- Channel Key Wrapping (ECDH ephemeral + AES-GCM) ---

export async function wrapChannelKeyForMember(
  channelKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<{ encryptedChannelKey: string; wrapperPublicKey: JsonWebKey }> {
  // Generate ephemeral key pair for this wrap operation
  const ephemeral = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits']);

  // Derive shared secret from ephemeral private + recipient public
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPublicKey },
    ephemeral.privateKey,
    AES_PARAMS,
    false,
    ['encrypt']
  );

  // Export channel key and encrypt with shared secret
  const channelKeyRaw = await exportChannelKey(channelKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    channelKeyRaw
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return {
    encryptedChannelKey: bufferToBase64(combined),
    wrapperPublicKey: await exportPublicKey(ephemeral.publicKey),
  };
}

export async function unwrapChannelKey(
  encryptedChannelKey: string,
  wrapperPublicKeyJwk: JsonWebKey,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrapperPublicKey = await importPublicKey(wrapperPublicKeyJwk);

  // Derive the same shared secret
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: wrapperPublicKey },
    recipientPrivateKey,
    AES_PARAMS,
    false,
    ['decrypt']
  );

  const combined = base64ToBuffer(encryptedChannelKey);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const channelKeyRaw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  );

  return importChannelKey(channelKeyRaw);
}

// --- Message Encrypt/Decrypt ---

export async function encryptMessage(
  plaintext: string,
  channelKey: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToBase64(combined);
}

export async function decryptMessage(
  encrypted: string,
  channelKey: CryptoKey
): Promise<string> {
  const combined = base64ToBuffer(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// --- Helpers ---

export function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}
