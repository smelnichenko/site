import { describe, it, expect } from 'vitest'
import { hasLeadingZeroBits, solve } from './hashcash'

describe('hashcash', () => {
  describe('hasLeadingZeroBits', () => {
    it('returns true for all-zero hash with any difficulty', () => {
      const hash = new Uint8Array([0, 0, 0, 0])
      expect(hasLeadingZeroBits(hash, 1)).toBe(true)
      expect(hasLeadingZeroBits(hash, 8)).toBe(true)
      expect(hasLeadingZeroBits(hash, 16)).toBe(true)
      expect(hasLeadingZeroBits(hash, 32)).toBe(true)
    })

    it('returns true for 0 difficulty', () => {
      const hash = new Uint8Array([0xff, 0xff])
      expect(hasLeadingZeroBits(hash, 0)).toBe(true)
    })

    it('checks partial byte bits correctly', () => {
      // 0b00001111 = 0x0f — 4 leading zero bits
      const hash = new Uint8Array([0x0f])
      expect(hasLeadingZeroBits(hash, 4)).toBe(true)
      expect(hasLeadingZeroBits(hash, 5)).toBe(false)
    })

    it('returns false when full byte is non-zero', () => {
      const hash = new Uint8Array([0x01, 0x00])
      expect(hasLeadingZeroBits(hash, 8)).toBe(false)
    })

    it('checks combined full bytes and partial bits', () => {
      // First byte all zeros, second byte 0b00111111 = 0x3f (2 leading zeros)
      const hash = new Uint8Array([0x00, 0x3f])
      expect(hasLeadingZeroBits(hash, 10)).toBe(true)  // 8 + 2 leading zeros
      expect(hasLeadingZeroBits(hash, 11)).toBe(false)
    })
  })

  describe('solve', () => {
    it('finds a valid nonce for low difficulty', async () => {
      const result = await solve('test-challenge', 1)
      expect(result.nonce).toBeDefined()
      expect(Number(result.nonce)).toBeGreaterThanOrEqual(0)
      expect(result.iterations).toBeGreaterThan(0)

      // Verify the solution
      const input = `test-challenge:${result.nonce}`
      const data = new TextEncoder().encode(input)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hash = new Uint8Array(hashBuffer)
      expect(hasLeadingZeroBits(hash, 1)).toBe(true)
    })

    it('finds valid nonce for higher difficulty', async () => {
      const result = await solve('another-challenge', 4)
      const input = `another-challenge:${result.nonce}`
      const data = new TextEncoder().encode(input)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hash = new Uint8Array(hashBuffer)
      expect(hasLeadingZeroBits(hash, 4)).toBe(true)
    })
  })
})
