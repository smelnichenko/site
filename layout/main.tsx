/**
 * The masi pages - and the monitor's RSS feed and settings pages - as the app shows them — the real components under the real stylesheet, in the app's
 * <main className="container"> — at the route `?path=` names. No login: the layout test answers the pages'
 * API calls itself (layout/fixtures.ts), so the pages render whatever they would render with that data.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../src/index.css';
import { LoadingProvider } from '../src/contexts/LoadingProvider';
import MonitorConfig from '../src/pages/MonitorConfig';
import RssFeedDetail from '../src/pages/RssFeedDetail';
import MasiCalendar from '../src/pages/masi/MasiCalendar';
import MasiCompanyDetail from '../src/pages/masi/MasiCompanyDetail';
import MasiCv from '../src/pages/masi/MasiCv';
import MasiJobDetail from '../src/pages/masi/MasiJobDetail';
import MasiJobs from '../src/pages/masi/MasiJobs';
import MasiPackages from '../src/pages/masi/MasiPackages';
import MasiPersonDetail from '../src/pages/masi/MasiPersonDetail';

const path = new URLSearchParams(location.search).get('path') ?? '/masi/cv';
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <main className="container">
          <Routes>
            <Route path="/masi/calendar" element={<MasiCalendar />} />
            <Route path="/masi/companies/:id" element={<MasiCompanyDetail />} />
            <Route path="/masi/cv" element={<MasiCv />} />
            <Route path="/masi/jobs" element={<MasiJobs />} />
            <Route path="/masi/jobs/:id" element={<MasiJobDetail />} />
            <Route path="/masi/packages" element={<MasiPackages />} />
            <Route path="/masi/persons/:id" element={<MasiPersonDetail />} />
            <Route path="/rss/:feedName" element={<RssFeedDetail />} />
            <Route
              path="/config"
              element={
                <LoadingProvider>
                  <MonitorConfig />
                </LoadingProvider>
              }
            />
          </Routes>
        </main>
      </MemoryRouter>
    </StrictMode>,
  );
}
