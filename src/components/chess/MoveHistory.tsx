interface MoveHistoryProps {
  pgn: string | null;
}

export default function MoveHistory({ pgn }: Readonly<MoveHistoryProps>) {
  if (!pgn) return null;

  // Parse PGN into move pairs: "1. e4 e5 2. Nf3 Nc6" → [["e4", "e5"], ["Nf3", "Nc6"]]
  const tokens = pgn.trim().split(/\s+/);
  const moves: [string, string?][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    if (/^\d+\./.test(token)) {
      if (current.length > 0) {
        moves.push(current.length === 2 ? [current[0], current[1]] : [current[0]]);
      }
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) {
    moves.push(current.length === 2 ? [current[0], current[1]] : [current[0]]);
  }

  return (
    <div className="chess-move-history">
      <h4>Moves</h4>
      <div className="chess-moves-table">
        {moves.map((pair, i) => (
          <div key={`${i + 1}-${pair[0]}-${pair[1] ?? ''}`} className="chess-move-row">
            <span className="chess-move-number">{i + 1}.</span>
            <span className="chess-move-white">{pair[0]}</span>
            <span className="chess-move-black">{pair[1] || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
