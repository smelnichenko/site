import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MasiTable from './MasiTable';

describe('MasiTable', () => {
  it('puts the table in a labelled region a keyboard can reach and scroll', () => {
    render(
      <MasiTable label="Jobs" className="masi-runs" testId="runs-cvee">
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
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

  it('is a plain table without the extras', () => {
    render(
      <MasiTable label="Sources">
        <tbody />
      </MasiTable>,
    );
    const table = within(screen.getByRole('region', { name: 'Sources' })).getByRole('table');
    expect(table.className).toBe('table');
    expect(table).not.toHaveAttribute('data-testid');
  });
});
