import { describe, it, expect } from 'vitest'
import {
  bufferToBase64,
  base64ToBuffer,
  generateIdentityKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKey,
  importPrivateKey,
  generateSalt,
  deriveWrappingKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateChannelKey,
  exportChannelKey,
  importChannelKey,
  wrapChannelKeyForMember,
  unwrapChannelKey,
  encryptMessage,
  decryptMessage,
} from './crypto'

describe('crypto - buffer helpers', () => {
  it('roundtrips bufferToBase64 and base64ToBuffer', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255])
    const b64 = bufferToBase64(original)
    const decoded = base64ToBuffer(b64)
    expect(decoded).toEqual(original)
  })

  it('encodes empty buffer', () => {
    const b64 = bufferToBase64(new Uint8Array([]))
    expect(b64).toBe('')
    expect(base64ToBuffer(b64)).toEqual(new Uint8Array([]))
  })
})

describe('crypto - identity key pair', () => {
  it('generates ECDH P-256 key pair', async () => {
    const keyPair = await generateIdentityKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey.algorithm).toMatchObject({ name: 'ECDH' })
  })

  it('exports and imports public key', async () => {
    const keyPair = await generateIdentityKeyPair()
    const jwk = await exportPublicKey(keyPair.publicKey)
    expect(jwk.kty).toBe('EC')
    expect(jwk.crv).toBe('P-256')

    const imported = await importPublicKey(jwk)
    expect(imported.algorithm).toMatchObject({ name: 'ECDH' })
  })

  it('exports and imports private key', async () => {
    const keyPair = await generateIdentityKeyPair()
    const pkcs8 = await exportPrivateKey(keyPair.privateKey)
    expect(pkcs8.byteLength).toBeGreaterThan(0)

    const imported = await importPrivateKey(pkcs8)
    expect(imported.algorithm).toMatchObject({ name: 'ECDH' })
  })
})

describe('crypto - salt generation', () => {
  it('generates 16-byte salt', () => {
    const salt = generateSalt()
    expect(salt).toBeInstanceOf(Uint8Array)
    expect(salt.length).toBe(16)
  })

  it('generates unique salts', () => {
    const salt1 = generateSalt()
    const salt2 = generateSalt()
    expect(bufferToBase64(salt1)).not.toBe(bufferToBase64(salt2))
  })
})

describe('crypto - PBKDF2 wrapping key', () => {
  it('derives AES-GCM key from password', async () => {
    const salt = generateSalt()
    const key = await deriveWrappingKey('test-password', salt.buffer as ArrayBuffer, 1000)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })
})

describe('crypto - private key encrypt/decrypt', () => {
  it('encrypts and decrypts private key', async () => {
    const keyPair = await generateIdentityKeyPair()
    const salt = generateSalt()
    const wrappingKey = await deriveWrappingKey('password', salt.buffer as ArrayBuffer, 1000)

    const encrypted = await encryptPrivateKey(keyPair.privateKey, wrappingKey)
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)

    const decrypted = await decryptPrivateKey(encrypted, wrappingKey)
    expect(decrypted.algorithm).toMatchObject({ name: 'ECDH' })

    // Verify the decrypted key matches by exporting both
    const originalExport = await exportPrivateKey(keyPair.privateKey)
    const decryptedExport = await exportPrivateKey(decrypted)
    expect(new Uint8Array(decryptedExport)).toEqual(new Uint8Array(originalExport))
  })
})

describe('crypto - channel key', () => {
  it('generates AES-256-GCM channel key', async () => {
    const key = await generateChannelKey()
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })

  it('exports and imports channel key', async () => {
    const key = await generateChannelKey()
    const raw = await exportChannelKey(key)
    expect(raw.byteLength).toBe(32) // 256 bits

    const imported = await importChannelKey(raw)
    expect(imported.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })
})

describe('crypto - channel key wrapping', () => {
  it('wraps and unwraps channel key for member', async () => {
    const channelKey = await generateChannelKey()
    const recipient = await generateIdentityKeyPair()

    const wrapped = await wrapChannelKeyForMember(channelKey, recipient.publicKey)
    expect(wrapped.encryptedChannelKey).toBeTruthy()
    expect(wrapped.wrapperPublicKey).toBeTruthy()

    const unwrapped = await unwrapChannelKey(
      wrapped.encryptedChannelKey,
      wrapped.wrapperPublicKey,
      recipient.privateKey
    )
    expect(unwrapped.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })

    // Verify unwrapped key matches original by encrypting/decrypting
    const testMsg = 'test message'
    const encrypted = await encryptMessage(testMsg, channelKey)
    const decrypted = await decryptMessage(encrypted, unwrapped)
    expect(decrypted).toBe(testMsg)
  })
})

describe('crypto - message encrypt/decrypt', () => {
  it('encrypts and decrypts a message', async () => {
    const key = await generateChannelKey()
    const plaintext = 'Hello, World!'
    const encrypted = await encryptMessage(plaintext, key)

    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toBe(plaintext)

    const decrypted = await decryptMessage(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('handles empty string', async () => {
    const key = await generateChannelKey()
    const encrypted = await encryptMessage('', key)
    const decrypted = await decryptMessage(encrypted, key)
    expect(decrypted).toBe('')
  })

  it('handles unicode', async () => {
    const key = await generateChannelKey()
    const plaintext = 'Hello \u{1F600} \u4E16\u754C'
    const encrypted = await encryptMessage(plaintext, key)
    const decrypted = await decryptMessage(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', async () => {
    const key = await generateChannelKey()
    const encrypted1 = await encryptMessage('same', key)
    const encrypted2 = await encryptMessage('same', key)
    expect(encrypted1).not.toBe(encrypted2)
  })
})
