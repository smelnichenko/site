import { useState, useEffect, useCallback } from 'react';
import {
  createChessGame,
  fetchActiveChessGames,
  fetchOpenChessGames,
  joinChessGame,
  abandonChessGame,
  type ChessGameDto,
} from '../../services/api';

interface GameLobbyProps {
  onGameSelected: (game: ChessGameDto) => void;
}

export default function GameLobby({ onGameSelected }: Readonly<GameLobbyProps>) {
  const [activeGames, setActiveGames] = useState<ChessGameDto[]>([]);
  const [openGames, setOpenGames] = useState<ChessGameDto[]>([]);
  const [difficulty, setDifficulty] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    try {
      const [active, open] = await Promise.all([fetchActiveChessGames(), fetchOpenChessGames()]);
      setActiveGames(active);
      setOpenGames(open);
    } catch {
      setError('Failed to load games');
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleCreateAi = async () => {
    setCreating(true);
    setError(null);
    try {
      const game = await createChessGame('AI', difficulty);
      onGameSelected(game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePvp = async () => {
    setCreating(true);
    setError(null);
    try {
      const game = await createChessGame('PVP');
      onGameSelected(game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (uuid: string) => {
    setError(null);
    try {
      const game = await joinChessGame(uuid);
      onGameSelected(game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    }
  };

  const handleAbandon = async (uuid: string) => {
    setError(null);
    try {
      await abandonChessGame(uuid);
      loadGames();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to abandon game');
    }
  };

  const difficultyLabel = (d: number) => {
    if (d <= 3) return 'Beginner';
    if (d <= 8) return 'Easy';
    if (d <= 13) return 'Intermediate';
    if (d <= 17) return 'Advanced';
    return 'Master';
  };

  return (
    <div className="chess-lobby">
      <h2>Chess</h2>
      {error && <div className="chess-error">{error}</div>}

      <div className="chess-lobby-section">
        <h3>Play vs AI</h3>
        <div className="chess-difficulty">
          <label>
            Difficulty: {difficulty} ({difficultyLabel(difficulty)})
            <input
              type="range"
              min={0}
              max={20}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            />
          </label>
        </div>
        <button className="btn-primary" onClick={handleCreateAi} disabled={creating}>
          {creating ? 'Creating...' : 'New AI Game'}
        </button>
      </div>

      <div className="chess-lobby-section">
        <h3>Player vs Player</h3>
        <button className="btn-primary" onClick={handleCreatePvp} disabled={creating}>
          {creating ? 'Creating...' : 'Create PvP Game'}
        </button>
      </div>

      {activeGames.length > 0 && (
        <div className="chess-lobby-section">
          <h3>Your Active Games</h3>
          <div className="chess-game-list">
            {activeGames.map((g) => (
              <div key={g.gameUuid} className="chess-game-item">
                <div className="chess-game-info">
                  <span className="chess-game-type">{g.gameType}</span>
                  <span className="chess-game-status">{g.status.replaceAll('_', ' ')}</span>
                  <span className="chess-game-moves">{g.moveCount} moves</span>
                </div>
                <div className="chess-game-actions">
                  {g.status === 'IN_PROGRESS' && (
                    <button className="btn-small" onClick={() => onGameSelected(g)}>
                      Resume
                    </button>
                  )}
                  {g.status === 'WAITING_FOR_OPPONENT' && (
                    <>
                      <span className="chess-waiting">Waiting...</span>
                      <button className="btn-small btn-danger" onClick={() => handleAbandon(g.gameUuid)}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openGames.length > 0 && (
        <div className="chess-lobby-section">
          <h3>Open Games</h3>
          <div className="chess-game-list">
            {openGames.map((g) => (
              <div key={g.gameUuid} className="chess-game-item">
                <div className="chess-game-info">
                  <span className="chess-game-type">PvP</span>
                  <span className="chess-game-status">Waiting for opponent</span>
                </div>
                <button className="btn-small btn-primary" onClick={() => handleJoin(g.gameUuid)}>
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
