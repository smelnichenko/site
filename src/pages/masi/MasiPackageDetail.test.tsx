import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import MasiPackageDetail from './MasiPackageDetail';
import { prepared } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiPackage: vi.fn(),
  reviewMasiPackage: vi.fn(),
  regenerateMasiPackage: vi.fn(),
  fetchMasiArtifact: vi.fn(),
}));
vi.mock('../../components/MasiNav', () => ({ default: () => null }));
const api = await import('../../services/api');

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

beforeEach(() => {
  vi.mocked(api.fetchMasiPackage).mockReset();
  vi.mocked(api.regenerateMasiPackage).mockReset();
});

describe('MasiPackageDetail', () => {
  function renderPackage() {
    render(
      <MemoryRouter initialEntries={['/masi/packages/11']}>
        <Routes>
          <Route path="/masi/packages/:id" element={<MasiPackageDetail />} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
  }

  it("regenerated in another language, moves to that CV's package's own page", async () => {
    vi.mocked(api.fetchMasiPackage).mockResolvedValue({
      ...prepared,
      writtenIn: 'en',
      tunedFromVersion: 2,
    });
    vi.mocked(api.regenerateMasiPackage).mockResolvedValue({
      ...prepared,
      id: 12,
      status: 'NEW',
      language: 'et',
      writtenIn: null,
      tunedFromVersion: null,
    });
    renderPackage();
    await userEvent.selectOptions(await screen.findByLabelText('Language of package #11'), 'et');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/masi/packages/12'));
  });

  it('regenerated in its own language, stays on its page', async () => {
    vi.mocked(api.fetchMasiPackage).mockResolvedValue({
      ...prepared,
      writtenIn: 'en',
      tunedFromVersion: 2,
    });
    vi.mocked(api.regenerateMasiPackage).mockResolvedValue({
      ...prepared,
      status: 'NEW',
      writtenIn: null,
      tunedFromVersion: null,
    });
    renderPackage();
    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(api.regenerateMasiPackage).toHaveBeenCalledWith(11, 'auto'));
    expect(screen.getByTestId('where')).toHaveTextContent('/masi/packages/11');
  });
});
