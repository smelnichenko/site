import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import Game from './Game'

vi.mock('../services/api', () => ({
  fetchGameState: vi.fn(),
  spinGame: vi.fn(),
  resetGame: vi.fn(),
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Game', () => {
  it('renders iframe with game', () => {
    render(<Game />)
    const iframe = screen.getByTitle('Slot Machine Board Game')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', '/game/index.html')
  })

  it('does not show error initially', () => {
    render(<Game />)
    expect(screen.queryByText(/Error/)).not.toBeInTheDocument()
  })

  it('fetches and sends game state when godot is ready', async () => {
    vi.mocked(api.fetchGameState).mockResolvedValue({ id: 1, player1Position: 0, player2Position: 0, currentTurn: 1, totalSpins: 0, completed: false, winner: null })
    vi.useRealTimers()

    render(<Game />)
    const iframe = screen.getByTitle('Slot Machine Board Game') as HTMLIFrameElement
    const win = iframe.contentWindow as Window & { _gameReady?: boolean; _godotReceive?: unknown }
    if (win) {
      Object.defineProperty(win, '_gameReady', { value: true, writable: true, configurable: true })
      Object.defineProperty(win, '_godotReceive', { value: vi.fn(), writable: true, configurable: true })
    }

    await waitFor(() => {
      expect(api.fetchGameState).toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('handles postMessage from Godot for spin', async () => {
    vi.mocked(api.spinGame).mockResolvedValue({ colors: ['red'], player1Position: 3, player2Position: 0, currentTurn: 2, completed: false, winner: 0, totalSpins: 1 })
    vi.useRealTimers()

    render(<Game />)

    await act(async () => {
      globalThis.dispatchEvent(new MessageEvent('message', {
        data: { source: 'godot', type: 'spin' },
      }))
    })

    await waitFor(() => {
      expect(api.spinGame).toHaveBeenCalled()
    })
  })

  it('handles postMessage from Godot for reset', async () => {
    vi.mocked(api.resetGame).mockResolvedValue({ id: 1, player1Position: 0, player2Position: 0, currentTurn: 1, totalSpins: 0, completed: false, winner: null })
    vi.useRealTimers()

    render(<Game />)

    await act(async () => {
      globalThis.dispatchEvent(new MessageEvent('message', {
        data: { source: 'godot', type: 'reset' },
      }))
    })

    await waitFor(() => {
      expect(api.resetGame).toHaveBeenCalled()
    })
  })

  it('ignores messages without godot source', async () => {
    vi.useRealTimers()
    render(<Game />)

    await act(async () => {
      globalThis.dispatchEvent(new MessageEvent('message', {
        data: { source: 'other', type: 'spin' },
      }))
    })

    expect(api.spinGame).not.toHaveBeenCalled()
  })

  it('shows error when spin fails', async () => {
    vi.mocked(api.spinGame).mockRejectedValue(new Error('Network error'))
    vi.useRealTimers()

    render(<Game />)

    await act(async () => {
      globalThis.dispatchEvent(new MessageEvent('message', {
        data: { source: 'godot', type: 'spin' },
      }))
    })

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
