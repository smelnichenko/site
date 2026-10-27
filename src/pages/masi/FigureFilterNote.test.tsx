import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FigureFilterNote from './FigureFilterNote';
import { looseSeparators } from './testUtils';

describe('FigureFilterNote', () => {
  const period = { words: 'closed', from: '2026-03-22T22:00:00Z', to: '2026-03-29T21:00:00Z' };

  it('names the period and the parts, each date one unbroken piece, each "·" kept with the part before it', () => {
    render(
      <FigureFilterNote period={period} parts={['on cvee', 'tagged java']} onClear={() => {}} />,
    );
    const note = screen.getByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent('closed 23 Mar 2026 – 29 Mar 2026 · on cvee · tagged java');
    // a date is its own element, under the rule that keeps it on one line
    expect(screen.getByText('23 Mar 2026')).toHaveClass('masi-nowrap');
    expect(screen.getByText('29 Mar 2026')).toHaveClass('masi-nowrap');
    expect(looseSeparators(note.textContent)).toEqual([]);
  });

  it('shows parts alone with no period, and clears by a named button', async () => {
    const onClear = vi.fn();
    render(<FigureFilterNote parts={['on cvee']} onClear={onClear} />);
    const note = screen.getByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent(/^on cvee/);
    expect(note).not.toHaveTextContent('·');
    await userEvent.click(screen.getByRole('button', { name: 'clear the report filter' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
