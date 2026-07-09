import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock stockfish Web Worker
vi.mock('../hooks/useStockfish', () => ({
  useStockfish: () => ({
    getBestMove: vi.fn().mockResolvedValue('e7e5'),
    stop: vi.fn(),
  }),
}));

// Mock react-chessboard. The real component takes its position via `options`.
vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { position: string } }) => (
    <div data-testid="chessboard" data-position={options.position}>
      Chessboard
    </div>
  ),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    uuid: 'uuid-1',
    email: 'test@test.com',
    isAuthenticated: true,
    hasPermission: () => true,
    permissions: ['PLAY'],
    groups: [],
    logout: vi.fn(),
  }),
}));

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
}));

// Capture the realtime publication handler so tests can deliver an opponent
// update and assert the subscription is torn down on cleanup.
const subscription = { unsubscribe: vi.fn() };
let lastPublicationHandler: ((game: ChessGameDto) => void) | null = null;
vi.mock('../services/centrifugoClient', () => ({
  subscribe: vi.fn((_channel: string, opts: { onPublication: (game: ChessGameDto) => void }) => {
    lastPublicationHandler = opts.onPublication;
    return subscription;
  }),
}));

const api = await import('../services/api');
const centrifugoClient = await import('../services/centrifugoClient');
type ChessGameDto = Awaited<ReturnType<typeof api.fetchChessGame>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchActiveChessGames).mockResolvedValue([]);
  vi.mocked(api.fetchOpenChessGames).mockResolvedValue([]);
  subscription.unsubscribe.mockClear();
  lastPublicationHandler = null;
});

// Must import after mocks
const { default: Chess } = await import('./Chess');

describe('Chess', () => {
  describe('Lobby', () => {
    it('renders lobby with create buttons', async () => {
      render(<Chess />);
      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument();
        expect(screen.getByText('Create PvP Game')).toBeInTheDocument();
      });
    });

    it('shows difficulty slider', async () => {
      render(<Chess />);
      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
    });

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
        whitePlayerUuid: 'uuid-1',
        blackPlayerUuid: null,
        drawOfferedByUuid: null,
        aiDifficulty: 10,
        updatedAt: '2026-03-17T00:00:00Z',
      };
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame);

      render(<Chess />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New AI Game'));

      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toBeInTheDocument();
      });
    });

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
          whitePlayerUuid: 'uuid-1',
          blackPlayerUuid: null,
          drawOfferedByUuid: null,
          aiDifficulty: 10,
          updatedAt: '2026-03-17T00:00:00Z',
        },
      ]);

      render(<Chess />);

      await waitFor(() => {
        expect(screen.getByText('Your Active Games')).toBeInTheDocument();
        expect(screen.getByText('Resume')).toBeInTheDocument();
      });
    });

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
          whitePlayerUuid: 'uuid-2',
          blackPlayerUuid: null,
          drawOfferedByUuid: null,
          aiDifficulty: null,
          updatedAt: '2026-03-17T00:00:00Z',
        },
      ]);

      render(<Chess />);

      await waitFor(() => {
        expect(screen.getByText('Open Games')).toBeInTheDocument();
        expect(screen.getByText('Join')).toBeInTheDocument();
      });
    });
  });

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
      whitePlayerUuid: 'uuid-1',
      blackPlayerUuid: null,
      drawOfferedByUuid: null,
      aiDifficulty: 10,
      updatedAt: '2026-03-17T00:00:00Z',
    };

    it('shows resign button during active game', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame);

      render(<Chess />);
      const user = userEvent.setup();
      await user.click(await screen.findByText('New AI Game'));

      await waitFor(() => {
        expect(screen.getByText('Resign')).toBeInTheDocument();
      });
    });

    it('shows game type badge', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame);

      render(<Chess />);
      const user = userEvent.setup();
      await user.click(await screen.findByText('New AI Game'));

      await waitFor(() => {
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('Level 10')).toBeInTheDocument();
      });
    });

    it('shows game over dialog on finished game', async () => {
      const finishedGame = {
        ...mockGame,
        status: 'FINISHED' as const,
        result: 'WHITE_WINS' as const,
        resultReason: 'CHECKMATE' as const,
      };
      vi.mocked(api.createChessGame).mockResolvedValue(finishedGame);

      render(<Chess />);
      const user = userEvent.setup();
      await user.click(await screen.findByText('New AI Game'));

      await waitFor(() => {
        expect(screen.getByText('You Win!')).toBeInTheDocument();
        expect(screen.getByText('by checkmate')).toBeInTheDocument();
      });
    });

    it('back to lobby button returns to lobby', async () => {
      vi.mocked(api.createChessGame).mockResolvedValue(mockGame);

      render(<Chess />);
      const user = userEvent.setup();
      await user.click(await screen.findByText('New AI Game'));

      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back to Lobby'));

      await waitFor(() => {
        expect(screen.getByText('New AI Game')).toBeInTheDocument();
      });
    });
  });

  describe('Realtime (PvP)', () => {
    // White is the opponent (uuid-2) and it is white's turn, so the logged-in
    // player (uuid-1, black) is waiting and the subscription path activates.
    const opponentsTurnGame = {
      gameUuid: 'pvp-uuid',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: null,
      status: 'IN_PROGRESS' as const,
      result: null,
      resultReason: null,
      gameType: 'PVP' as const,
      moveCount: 0,
      lastMove: null,
      whitePlayerUuid: 'uuid-2',
      blackPlayerUuid: 'uuid-1',
      drawOfferedByUuid: null,
      aiDifficulty: null,
      updatedAt: '2026-03-17T00:00:00Z',
    };

    async function enterOpponentsTurnGame() {
      vi.mocked(api.fetchActiveChessGames).mockResolvedValue([opponentsTurnGame]);
      render(<Chess />);
      const resume = await screen.findByText('Resume');
      // Resume only calls setCurrentGame synchronously, so a sync act flushes
      // the effect that calls subscribe — no async/await needed.
      act(() => {
        resume.click();
      });
      await waitFor(() => expect(centrifugoClient.subscribe).toHaveBeenCalled());
    }

    it('subscribes to the game channel while waiting for the opponent', async () => {
      await enterOpponentsTurnGame();
      const [channel, opts] = vi.mocked(centrifugoClient.subscribe).mock.calls[0];
      expect(channel).toBe('chess:game:pvp-uuid');
      expect(opts.onPublication).toBeTypeOf('function');
    });

    it('updates the board from a live opponent publication', async () => {
      await enterOpponentsTurnGame();
      const movedGame = {
        ...opponentsTurnGame,
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        moveCount: 1,
        lastMove: 'e2e4',
      };

      act(() => {
        lastPublicationHandler?.(movedGame);
      });

      // ChessBoard loads the FEN into chess.js and renders the normalized
      // position; assert the piece placement reflects the opponent's e4.
      await waitFor(() => {
        const board = screen.getByTestId('chessboard');
        expect(board.dataset.position).toMatch(
          /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR/,
        );
      });
    });

    it('unsubscribes when leaving the game', async () => {
      await enterOpponentsTurnGame();
      await act(async () => {
        (await screen.findByText('Back to Lobby')).click();
      });
      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    // Mount straight into the opponent's-turn game under fake timers so the
    // 30s REST-poll fallback interval can be advanced deterministically.
    async function mountOpponentsTurnGameWithFakeTimers() {
      vi.useFakeTimers();
      vi.mocked(api.fetchActiveChessGames).mockResolvedValue([opponentsTurnGame]);
      render(<Chess />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const resume = screen.getByText('Resume');
      act(() => {
        resume.click();
      });
      expect(centrifugoClient.subscribe).toHaveBeenCalled();
    }

    it('refreshes the game via the REST poll fallback', async () => {
      const polledGame = {
        ...opponentsTurnGame,
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        moveCount: 1,
        lastMove: 'e2e4',
      };
      vi.mocked(api.fetchChessGame).mockResolvedValue(polledGame);

      try {
        await mountOpponentsTurnGameWithFakeTimers();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });

        expect(api.fetchChessGame).toHaveBeenCalledWith('pvp-uuid');
        const board = screen.getByTestId('chessboard');
        expect(board.dataset.position).toMatch(
          /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR/,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('swallows poll errors without crashing', async () => {
      vi.mocked(api.fetchChessGame).mockRejectedValue(new Error('network'));

      try {
        await mountOpponentsTurnGameWithFakeTimers();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });

        expect(api.fetchChessGame).toHaveBeenCalledWith('pvp-uuid');
        // Board still renders the pre-poll position.
        expect(screen.getByTestId('chessboard')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not subscribe when it is the player's turn", async () => {
      const myTurnGame = {
        ...opponentsTurnGame,
        whitePlayerUuid: 'uuid-1',
        blackPlayerUuid: 'uuid-2',
      };
      vi.mocked(api.fetchActiveChessGames).mockResolvedValue([myTurnGame]);
      render(<Chess />);
      const resume = await screen.findByText('Resume');
      act(() => {
        resume.click();
      });
      expect(await screen.findByTestId('chessboard')).toBeInTheDocument();
      expect(centrifugoClient.subscribe).not.toHaveBeenCalled();
    });
  });
});
