import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  makeChessMove,
  makeChessAiMove,
  resignChessGame,
  offerChessDraw,
  acceptChessDraw,
  declineChessDraw,
  fetchChessGame,
  type ChessGameDto,
} from '../services/api';
import { useStockfish } from '../hooks/useStockfish';
import ChessBoard from '../components/chess/ChessBoard';
import GameLobby from '../components/chess/GameLobby';
import MoveHistory from '../components/chess/MoveHistory';
import GameControls from '../components/chess/GameControls';
import GameOverDialog from '../components/chess/GameOverDialog';

export default function Chess() {
  const { userId } = useAuth();
  const [currentGame, setCurrentGame] = useState<ChessGameDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { getBestMove } = useStockfish({
    skillLevel: currentGame?.aiDifficulty ?? 10,
    moveTimeMs: Math.min(1000 + (currentGame?.aiDifficulty ?? 10) * 200, 5000),
  });

  // Poll for PvP opponent moves
  useEffect(() => {
    if (!currentGame || currentGame.gameType !== 'PVP' || currentGame.status !== 'IN_PROGRESS') {
      return;
    }

    const isMyTurn =
      (currentGame.fen.includes(' w ') && userId === currentGame.whitePlayerId) ||
      (currentGame.fen.includes(' b ') && userId === currentGame.blackPlayerId);

    // Only poll when it's NOT my turn (waiting for opponent)
    if (isMyTurn) return;

    pollRef.current = setInterval(async () => {
      try {
        const updated = await fetchChessGame(currentGame.gameUuid);
        if (updated.fen !== currentGame.fen || updated.status !== currentGame.status) {
          setCurrentGame(updated);
        }
      } catch {
        // Ignore poll errors
      }
    }, 1500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentGame, userId]);

  const handleMove = useCallback(
    async (move: string) => {
      if (!currentGame) return;
      setError(null);
      try {
        const updated = await makeChessMove(currentGame.gameUuid, move);
        setCurrentGame(updated);

        // For AI games: if game is still in progress and it's AI's turn, get Stockfish move
        if (updated.gameType === 'AI' && updated.status === 'IN_PROGRESS' && updated.fen.includes(' b ')) {
          setAiThinking(true);
          try {
            const aiMove = await getBestMove(updated.fen);
            const afterAi = await makeChessAiMove(currentGame.gameUuid, aiMove);
            setCurrentGame(afterAi);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'AI move failed');
          } finally {
            setAiThinking(false);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Move failed');
      }
    },
    [currentGame, getBestMove]
  );

  const handleResign = useCallback(async () => {
    if (!currentGame) return;
    try {
      const updated = await resignChessGame(currentGame.gameUuid);
      setCurrentGame(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resign failed');
    }
  }, [currentGame]);

  const handleOfferDraw = useCallback(async () => {
    if (!currentGame) return;
    try {
      const updated = await offerChessDraw(currentGame.gameUuid);
      setCurrentGame(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draw offer failed');
    }
  }, [currentGame]);

  const handleAcceptDraw = useCallback(async () => {
    if (!currentGame) return;
    try {
      const updated = await acceptChessDraw(currentGame.gameUuid);
      setCurrentGame(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept draw failed');
    }
  }, [currentGame]);

  const handleDeclineDraw = useCallback(async () => {
    if (!currentGame) return;
    try {
      const updated = await declineChessDraw(currentGame.gameUuid);
      setCurrentGame(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decline draw failed');
    }
  }, [currentGame]);

  const handleBack = useCallback(() => {
    setCurrentGame(null);
    setError(null);
  }, []);

  if (!userId) return null;

  if (!currentGame) {
    return <GameLobby onGameSelected={setCurrentGame} />;
  }

  const turnLabel =
    currentGame.status === 'IN_PROGRESS'
      ? currentGame.fen.includes(' w ')
        ? 'White to move'
        : 'Black to move'
      : '';

  return (
    <div className="chess-game-view">
      {error && <div className="chess-error">{error}</div>}

      <div className="chess-game-layout">
        <div className="chess-board-panel">
          <div className="chess-turn-indicator">
            {aiThinking ? 'AI is thinking...' : turnLabel}
          </div>
          <ChessBoard
            game={currentGame}
            userId={userId}
            onMove={handleMove}
            disabled={aiThinking}
          />
        </div>

        <div className="chess-side-panel">
          <div className="chess-game-meta">
            <span className="chess-game-type-badge">{currentGame.gameType}</span>
            {currentGame.aiDifficulty != null && (
              <span className="chess-difficulty-badge">Level {currentGame.aiDifficulty}</span>
            )}
          </div>

          <MoveHistory pgn={currentGame.pgn} />

          <GameControls
            game={currentGame}
            userId={userId}
            onResign={handleResign}
            onOfferDraw={handleOfferDraw}
            onAcceptDraw={handleAcceptDraw}
            onDeclineDraw={handleDeclineDraw}
            onBack={handleBack}
            disabled={aiThinking}
          />
        </div>
      </div>

      <GameOverDialog
        game={currentGame}
        userId={userId}
        onNewGame={handleBack}
        onBack={handleBack}
      />
    </div>
  );
}
