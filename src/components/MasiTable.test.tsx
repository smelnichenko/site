import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MasiTable from './MasiTable';

/** jsdom lays nothing out: the widths a browser would measure are stubbed on the prototype. */
function layout(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const body = (
  <tbody>
    <tr>
      <td>cell</td>
    </tr>
  </tbody>
);

describe('MasiTable', () => {
  it('is a labelled region a keyboard can reach when the table is wider than its card', () => {
    layout(505, 350);
    render(
      <MasiTable label="Jobs" className="masi-runs" testId="runs-cvee">
        {body}
      </MasiTable>,
    );
    const region = screen.getByRole('region', { name: 'Jobs' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('masi-table-scroll');
    const table = within(region).getByRole('table');
    expect(table).toHaveClass('table', 'masi-runs');
    expect(table).toHaveAttribute('data-testid', 'runs-cvee');
    expect(within(table).getByText('cell')).toBeInTheDocument();
  });

  it('is no tab stop and no landmark when the table fits: there is nothing off-screen to reach', () => {
    layout(1240, 1240);
    render(<MasiTable label="Jobs">{body}</MasiTable>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(table.className).toBe('table');
    expect(table).not.toHaveAttribute('data-testid');
    // the scroller is still there for the day the table grows
    expect(screen.getByTestId('masi-table-scroll')).not.toHaveAttribute('tabindex');
  });

  it('does not take a sub-pixel difference for an overflow', () => {
    layout(351, 350);
    render(<MasiTable label="Jobs">{body}</MasiTable>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
