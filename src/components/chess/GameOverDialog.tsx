import type { ChessGameDto } from '../../services/api';

interface GameOverDialogProps {
  game: ChessGameDto;
  userId: number;
  onNewGame: () => void;
  onBack: () => void;
}

export default function GameOverDialog({ game, userId, onNewGame, onBack }: GameOverDialogProps) {
  if (game.status !== 'FINISHED' && game.status !== 'ABANDONED') return null;

  const getResultText = () => {
    if (game.status === 'ABANDONED') return 'Game Abandoned';
    if (game.result === 'DRAW') return 'Draw';
    const isWhite = userId === game.whitePlayerId;
    const playerWon =
      (game.result === 'WHITE_WINS' && isWhite) || (game.result === 'BLACK_WINS' && !isWhite);
    return playerWon ? 'You Win!' : 'You Lose';
  };

  const getReasonText = () => {
    switch (game.resultReason) {
      case 'CHECKMATE': return 'by checkmate';
      case 'RESIGNATION': return 'by resignation';
      case 'STALEMATE': return 'by stalemate';
      case 'AGREEMENT': return 'by agreement';
      case 'INSUFFICIENT_MATERIAL': return 'insufficient material';
      default: return '';
    }
  };

  return (
    <div className="chess-game-over">
      <div className="chess-game-over-content">
        <h3>{getResultText()}</h3>
        {game.resultReason && <p>{getReasonText()}</p>}
        <div className="chess-game-over-actions">
          <button className="btn-primary" onClick={onNewGame}>New Game</button>
          <button className="btn-small" onClick={onBack}>Back to Lobby</button>
        </div>
      </div>
    </div>
  );
}
