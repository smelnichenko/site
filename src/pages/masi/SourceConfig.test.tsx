import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeploymentSwitches, SourceConfig } from './SourceConfig';

vi.mock('../../services/api', () => ({
  fetchMasiSourceHistory: vi.fn(),
  fetchMasiSwitches: vi.fn(),
}));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiSourceHistory).mockReset();
  vi.mocked(api.fetchMasiSwitches).mockReset();
});

describe('SourceConfig', () => {
  it("shows the source's whole config, and every change with who made it", async () => {
    vi.mocked(api.fetchMasiSourceHistory).mockResolvedValue([
      {
        field: 'enabled',
        oldValue: 'false',
        newValue: 'true',
        changedBy: 'the operator',
        changedAt: '2026-11-08T10:00:00Z',
      },
      {
        field: 'config',
        oldValue: '{"orgs":[]}',
        newValue: '{"orgs":["bolt"]}',
        changedBy: 'a migration',
        changedAt: '2026-11-01T10:00:00Z',
      },
    ]);
    render(<SourceConfig id={7} configJson='{"orgs":["bolt"],"token":"****"}' />);
    expect(screen.getByTestId('config-7')).toHaveTextContent('"orgs": [ "bolt" ], "token": "****"');
    const changes = await screen.findByRole('list', { name: 'Changes' });
    const [enabled, config] = within(changes).getAllByRole('listitem');
    expect(enabled).toHaveTextContent('enabled by the operator: false → true');
    expect(config).toHaveTextContent('config by a migration');
    await userEvent.click(within(config).getByText('from, to'));
    expect(within(config).getByText(/"bolt"/)).toBeVisible();
    expect(api.fetchMasiSourceHistory).toHaveBeenCalledWith(7, expect.anything());
  });

  it('says when there is no config, and no change', async () => {
    vi.mocked(api.fetchMasiSourceHistory).mockResolvedValue([]);
    render(<SourceConfig id={8} configJson={null} />);
    expect(screen.getByText("No config: the collector's defaults.")).toBeInTheDocument();
    expect(await screen.findByText('No change recorded.')).toBeInTheDocument();
  });

  it('says so when the changes cannot be read', async () => {
    vi.mocked(api.fetchMasiSourceHistory).mockRejectedValue(new Error('masi down'));
    render(<SourceConfig id={9} configJson={null} />);
    expect(await screen.findByText('masi down')).toBeInTheDocument();
  });
});

describe('DeploymentSwitches', () => {
  it('shows every switch the running masi has, in words: on/off, durations, lists', async () => {
    vi.mocked(api.fetchMasiSwitches).mockResolvedValue({
      contactPictures: { enabled: true, revisit: 'PT720H', face: false },
      allowedHosts: ['cv.ee', 'cvkeskus.ee'],
    });
    render(<DeploymentSwitches />);
    const card = screen.getByRole('region', { name: 'Deployment switches' });
    expect(await within(card).findByText('contact pictures')).toBeInTheDocument();
    expect(card).toHaveTextContent('enabled: on');
    expect(card).toHaveTextContent('revisit: 30 days');
    expect(card).toHaveTextContent('face: off');
    expect(card).toHaveTextContent('cv.ee, cvkeskus.ee');
  });
});
