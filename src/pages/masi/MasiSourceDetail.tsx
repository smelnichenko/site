import { useParams } from 'react-router-dom';
import MasiSources from './MasiSources';

/**
 * One source alone (/masi/sources/:id), opened as the Sources page opens a row - its config, its changes and its last
 * runs - with its actions, and the way back to every source. Where the dashboard, a report and the weekly digest lead.
 * Keyed by the id: another source is a fresh page, never the last one's state.
 */
export default function MasiSourceDetail() {
  const { id } = useParams();
  return <MasiSources key={id} sourceId={Number(id)} />;
}
