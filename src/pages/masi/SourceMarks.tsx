/**
 * Where a job is listed right now: one mark per source with an open listing of it, as a list; a dash (with its
 * spoken form) when it is present nowhere. `labelledBy`: the id of the text that names the list, where there is one.
 */
export default function SourceMarks({
  sources,
  labelledBy,
}: Readonly<{ sources: string[]; labelledBy?: string }>) {
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
    <ul className="masi-sources" aria-labelledby={labelledBy}>
      {sources.map((s) => (
        <li key={s} className="masi-source-mark">
          {s}
        </li>
      ))}
    </ul>
  );
}
