import { useState, useCallback, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import type { ChessGameDto } from '../../services/api';

interface ChessBoardProps {
  game: ChessGameDto;
  uuid: string;
  onMove: (move: string) => Promise<void>;
  disabled?: boolean;
}

export default function ChessBoard({ game, uuid, onMove, disabled }: Readonly<ChessBoardProps>) {
  const [chess] = useState(() => new Chess(game.fen));
  const [position, setPosition] = useState(game.fen);
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [pendingMove, setPendingMove] = useState(false);
  const prevFenRef = useRef(game.fen);

  const orientation: 'white' | 'black' = uuid === game.whitePlayerUuid ? 'white' : 'black';
  const isMyTurn =
    game.status === 'IN_PROGRESS' &&
    ((chess.turn() === 'w' && uuid === game.whitePlayerUuid) ||
      (chess.turn() === 'b' && uuid === game.blackPlayerUuid));

  useEffect(() => {
    if (game.fen !== prevFenRef.current) {
      chess.load(game.fen);
      setPosition(game.fen);
      prevFenRef.current = game.fen;
      setMoveFrom(null);
      setOptionSquares({});
    }
  }, [game.fen, chess]);

  const getMoveOptions = useCallback(
    (square: Square) => {
      const moves = chess.moves({ square, verbose: true });
      if (moves.length === 0) return {};
      const options: Record<string, React.CSSProperties> = {};
      options[square] = { background: 'rgba(255, 255, 0, 0.4)', borderRadius: '50%' };
      moves.forEach((move) => {
        options[move.to] = {
          background:
            chess.get(move.to) === null
              ? 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)'
              : 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)',
          borderRadius: '50%',
        };
      });
      return options;
    },
    [chess]
  );

  const isPromotion = (piece: { type: string; color: string } | null | undefined, targetSquare: string): boolean => {
    return (
      piece?.type === 'p' &&
      ((piece.color === 'w' && targetSquare[1] === '8') || (piece.color === 'b' && targetSquare[1] === '1'))
    ) ?? false;
  };

  const selectSquare = (sq: Square) => {
    if (chess.get(sq)?.color === chess.turn()) {
      setMoveFrom(sq);
      setOptionSquares(getMoveOptions(sq));
    } else {
      setMoveFrom(null);
      setOptionSquares({});
    }
  };

  const handleSquareClick = useCallback(
    async ({ square }: { square: string }) => {
      const sq = square as Square;
      if (disabled || pendingMove || !isMyTurn) return;

      if (!moveFrom) {
        if (chess.get(sq)?.color === chess.turn()) {
          setMoveFrom(sq);
          setOptionSquares(getMoveOptions(sq));
        }
        return;
      }

      const moveStr = moveFrom + sq;
      const piece = chess.get(moveFrom);
      const fullMove = isPromotion(piece, sq) ? moveStr + 'q' : moveStr;

      try {
        const result = chess.move({ from: moveFrom, to: sq, promotion: 'q' });
        if (result) {
          setPosition(chess.fen());
          setMoveFrom(null);
          setOptionSquares({});
          setPendingMove(true);
          chess.undo();
          setPosition(prevFenRef.current);
          await onMove(fullMove);
        }
      } catch {
        selectSquare(sq);
      } finally {
        setPendingMove(false);
      }
    },
    [chess, disabled, pendingMove, isMyTurn, moveFrom, getMoveOptions, onMove]
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
      if (disabled || pendingMove || !isMyTurn || !targetSquare) return false;

      const piece = chess.get(sourceSquare as Square);
      const moveStr = sourceSquare + targetSquare + (isPromotion(piece, targetSquare) ? 'q' : '');

      try {
        const result = chess.move({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' });
        if (!result) return false;
        chess.undo();
        setPendingMove(true);
        void onMove(moveStr).finally(() => setPendingMove(false));
        return true;
      } catch {
        return false;
      }
    },
    [chess, disabled, pendingMove, isMyTurn, onMove]
  );

  return (
    <div className="chess-board-container">
      <Chessboard
        options={{
          position,
          onSquareClick: (args: { square: string }) => { void handleSquareClick(args); },
          onPieceDrop: handlePieceDrop,
          boardOrientation: orientation,
          squareStyles: optionSquares,
          animationDurationInMs: 200,
          allowDragging: isMyTurn && !disabled && !pendingMove,
        }}
      />
      {pendingMove && <div className="chess-thinking">Sending move...</div>}
    </div>
  );
}
