import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock stockfish Web Worker
vi.mock('../hooks/useStockfish', () => ({
  useStockfish: () => ({
    getBestMove: vi.fn().mockResolvedValue('e7e5'),
    stop: vi.fn(),
  }),
}))

// Mock react-chessboard
vi.mock('react-chessboard', () => ({
  Chessboard: ({ position }: { position: string }) => (
    <div data-testid="chessboard" data-position={position}>Chessboard</div>
  ),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    userId: 1,
    email: 'test@test.com',
    isAuthenticated: true,
    hasPermission: () => true,
    permissions: ['PLAY'],
    groups: [],
    logout: vi.fn(),
  }),
}))

vi.mock('../services/api', () => ({
  createChessGame: vi.fn(),
  fetchActiveChessGames: vi.fn().mockResolvedValue([]),
  fetchOpenChessGames: vi.fn().mockResolvedValue([]),
  fetchChessGame: vi.fn(),
  makeChessMove: vi.fn(),
  makeChessAiMove: vi.fn(),
  resignChessGame: vi.fn(),
  offerChessDraw: vi.fn(),
  acceptChessDraw: vi.fn(),
  declineChessDraw: vi.fn(),
  joinChessGame: vi.fn(),
  abandonChessGame: vi.fn(),
  fetchChessHistory: vi.fn(),
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.fetchActiveChessGames).mockResolvedValue([])
  vi.mocked(api.fetchOpenChessGames).mockResolvedValue([])
})

// Must import after mocks
const { default: Chess } = await import('./Chess')

describe('Chess', () => {
  describe('Lobby', () => {
    it('renders lobby with create buttons', async () => {
      render(<Chess />)
      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument()
        expect(screen.getByText('Create PvP Game')).toBeInTheDocument()
      })
    })

    it('shows difficulty slider', async () => {
      render(<Chess />)
      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument()
      })
    })

    it('creates AI game and shows board', async () => {
      const mockGame = {
        gameUuid: 'test-uuid',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: null,
        status: 'IN_PROGRESS' as const,
        result: null,
        resultReason: null,
        gameType: 'AI' as const,
        moveCount: 0,
        lastMove: null,
        whitePlayerId: 1,
        blackPlayerId: null,
        drawOfferedBy: null,
        aiDifficulty: 10,
        updatedAt: '2026-03-17T00:00:00Z',
      }
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame)

      render(<Chess />)
      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument()
      })

      await user.click(screen.getByText('New AI Game'))

      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toBeInTheDocument()
      })
    })

    it('shows active games list', async () => {
      vi.mocked(api.fetchActiveChessGames).mockResolvedValue([
        {
          gameUuid: 'active-1',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          pgn: '1. e4',
          status: 'IN_PROGRESS',
          result: null,
          resultReason: null,
          gameType: 'AI',
          moveCount: 1,
          lastMove: 'e2e4',
          whitePlayerId: 1,
          blackPlayerId: null,
          drawOfferedBy: null,
          aiDifficulty: 10,
          updatedAt: '2026-03-17T00:00:00Z',
        },
      ])

      render(<Chess />)

      await waitFor(() => {
        expect(screen.getByText('Your Active Games')).toBeInTheDocument()
        expect(screen.getByText('Resume')).toBeInTheDocument()
      })
    })

    it('shows open PvP games', async () => {
      vi.mocked(api.fetchOpenChessGames).mockResolvedValue([
        {
          gameUuid: 'open-1',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: null,
          status: 'WAITING_FOR_OPPONENT',
          result: null,
          resultReason: null,
          gameType: 'PVP',
          moveCount: 0,
          lastMove: null,
          whitePlayerId: 2,
          blackPlayerId: null,
          drawOfferedBy: null,
          aiDifficulty: null,
          updatedAt: '2026-03-17T00:00:00Z',
        },
      ])

      render(<Chess />)

      await waitFor(() => {
        expect(screen.getByText('Open Games')).toBeInTheDocument()
        expect(screen.getByText('Join')).toBeInTheDocument()
      })
    })
  })

  describe('Game View', () => {
    const mockGame = {
      gameUuid: 'test-uuid',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: null,
      status: 'IN_PROGRESS' as const,
      result: null,
      resultReason: null,
      gameType: 'AI' as const,
      moveCount: 0,
      lastMove: null,
      whitePlayerId: 1,
      blackPlayerId: null,
      drawOfferedBy: null,
      aiDifficulty: 10,
      updatedAt: '2026-03-17T00:00:00Z',
    }

    it('shows resign button during active game', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame)

      render(<Chess />)
      const user = userEvent.setup()
      await user.click(await screen.findByText('New AI Game'))

      await waitFor(() => {
        expect(screen.getByText('Resign')).toBeInTheDocument()
      })
    })

    it('shows game type badge', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame)

      render(<Chess />)
      const user = userEvent.setup()
      await user.click(await screen.findByText('New AI Game'))

      await waitFor(() => {
        expect(screen.getByText('AI')).toBeInTheDocument()
        expect(screen.getByText('Level 10')).toBeInTheDocument()
      })
    })

    it('shows game over dialog on finished game', async () => {
      const finishedGame = {
        ...mockGame,
        status: 'FINISHED' as const,
        result: 'WHITE_WINS' as const,
        resultReason: 'CHECKMATE' as const,
      }
      vi.mocked(api.createChessGame).mockResolvedValue(finishedGame)

      render(<Chess />)
      const user = userEvent.setup()
      await user.click(await screen.findByText('New AI Game'))

      await waitFor(() => {
        expect(screen.getByText('You Win!')).toBeInTheDocument()
        expect(screen.getByText('by checkmate')).toBeInTheDocument()
      })
    })

    it('back to lobby button returns to lobby', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame)

      render(<Chess />)
      const user = userEvent.setup()
      await user.click(await screen.findByText('New AI Game'))

      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Back to Lobby'))

      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument()
      })
    })
  })
})
