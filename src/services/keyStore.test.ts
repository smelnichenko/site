import { describe, it, expect, beforeEach } from 'vitest'
import * as keyStore from './keyStore'

beforeEach(() => {
  keyStore.clear()
})

describe('keyStore - identity keys', () => {
  it('starts with no identity keys', () => {
    expect(keyStore.getIdentityPrivateKey()).toBeNull()
    expect(keyStore.getIdentityPublicKey()).toBeNull()
    expect(keyStore.hasIdentityKeys()).toBe(false)
  })

  it('stores and retrieves identity keys', () => {
    const privateKey = {} as CryptoKey
    const publicKey = {} as CryptoKey
    keyStore.setIdentityKeys(privateKey, publicKey)

    expect(keyStore.getIdentityPrivateKey()).toBe(privateKey)
    expect(keyStore.getIdentityPublicKey()).toBe(publicKey)
    expect(keyStore.hasIdentityKeys()).toBe(true)
  })

  it('clear removes identity keys', () => {
    keyStore.setIdentityKeys({} as CryptoKey, {} as CryptoKey)
    keyStore.clear()

    expect(keyStore.hasIdentityKeys()).toBe(false)
    expect(keyStore.getIdentityPrivateKey()).toBeNull()
    expect(keyStore.getIdentityPublicKey()).toBeNull()
  })
})

describe('keyStore - channel keys', () => {
  it('returns null for unknown channel', () => {
    expect(keyStore.getChannelKey(1, 1)).toBeNull()
  })

  it('stores and retrieves channel key by version', () => {
    const key = {} as CryptoKey
    keyStore.setChannelKey(1, 1, key)

    expect(keyStore.getChannelKey(1, 1)).toBe(key)
    expect(keyStore.getChannelKey(1, 2)).toBeNull()
    expect(keyStore.getChannelKey(2, 1)).toBeNull()
  })

  it('stores multiple versions for same channel', () => {
    const key1 = { v: 1 } as unknown as CryptoKey
    const key2 = { v: 2 } as unknown as CryptoKey
    keyStore.setChannelKey(1, 1, key1)
    keyStore.setChannelKey(1, 2, key2)

    expect(keyStore.getChannelKey(1, 1)).toBe(key1)
    expect(keyStore.getChannelKey(1, 2)).toBe(key2)
  })

  it('getLatestChannelKey returns highest version', () => {
    const key1 = { v: 1 } as unknown as CryptoKey
    const key3 = { v: 3 } as unknown as CryptoKey
    keyStore.setChannelKey(1, 1, key1)
    keyStore.setChannelKey(1, 3, key3)

    expect(keyStore.getLatestChannelKey(1)).toBe(key3)
  })

  it('getLatestChannelKey returns null for unknown channel', () => {
    expect(keyStore.getLatestChannelKey(99)).toBeNull()
  })

  it('removeChannelKeys removes all versions for channel', () => {
    keyStore.setChannelKey(1, 1, {} as CryptoKey)
    keyStore.setChannelKey(1, 2, {} as CryptoKey)
    keyStore.removeChannelKeys(1)

    expect(keyStore.getChannelKey(1, 1)).toBeNull()
    expect(keyStore.getChannelKey(1, 2)).toBeNull()
  })

  it('clear removes all channel keys', () => {
    keyStore.setChannelKey(1, 1, {} as CryptoKey)
    keyStore.setChannelKey(2, 1, {} as CryptoKey)
    keyStore.clear()

    expect(keyStore.getChannelKey(1, 1)).toBeNull()
    expect(keyStore.getChannelKey(2, 1)).toBeNull()
  })
})
