import type { ChessGameDto } from '../../services/api';

interface GameControlsProps {
  game: ChessGameDto;
  uuid: string;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export default function GameControls({
  game,
  uuid,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onBack,
  disabled,
}: Readonly<GameControlsProps>) {
  const isFinished = game.status === 'FINISHED' || game.status === 'ABANDONED';
  const isPvp = game.gameType === 'PVP';
  const hasPendingDraw = game.drawOfferedByUuid !== null;
  const isDrawOfferedToMe = hasPendingDraw && game.drawOfferedByUuid !== uuid;

  return (
    <div className="chess-controls">
      {!isFinished && (
        <>
          <button className="btn-small btn-danger" onClick={onResign} disabled={disabled}>
            Resign
          </button>
          {isPvp && !hasPendingDraw && (
            <button className="btn-small" onClick={onOfferDraw} disabled={disabled}>
              Offer Draw
            </button>
          )}
          {isPvp && isDrawOfferedToMe && (
            <div className="chess-draw-offer">
              <span>Draw offered!</span>
              <button className="btn-small btn-primary" onClick={onAcceptDraw} disabled={disabled}>
                Accept
              </button>
              <button className="btn-small" onClick={onDeclineDraw} disabled={disabled}>
                Decline
              </button>
            </div>
          )}
          {isPvp && hasPendingDraw && !isDrawOfferedToMe && (
            <span className="chess-draw-pending">Draw offer sent...</span>
          )}
        </>
      )}
      <button className="btn-small" onClick={onBack}>
        Back to Lobby
      </button>
    </div>
  );
}
