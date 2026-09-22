/** Where a job is listed right now: one mark per source with an open listing of it; a dash when it is present nowhere. */
export default function SourceMarks({ sources }: Readonly<{ sources: string[] }>) {
  if (sources.length === 0) {
    return (
      <>
        <span className="muted" aria-hidden="true">
          —
        </span>
        <span className="sr-only">not listed anywhere</span>
      </>
    );
  }
  return (
    <span className="masi-sources">
      {sources.map((s) => (
        <span key={s} className="masi-source-mark">
          {s}
        </span>
      ))}
    </span>
  );
}
