import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SortableHeader } from './SortableHeader';
import { useUrlSort } from './sorting';

function header(sort: string, onSort = vi.fn()) {
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader column="name" label="Name" sort={sort} onSort={onSort} />
        </tr>
      </thead>
    </table>,
  );
  return onSort;
}

describe('SortableHeader', () => {
  it('says the column is not sorted, and a press sorts it ascending', async () => {
    const onSort = header('lastSeenAt,desc');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name,asc');
  });

  it('says ascending and shows ▲; the next press sorts descending', async () => {
    const onSort = header('name,asc');
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('button').textContent).toBe('Name\u00a0▲');
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name,desc');
  });

  it('says descending and shows ▼; the next press sorts ascending again', async () => {
    const onSort = header('name,desc');
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('button').textContent).toBe('Name\u00a0▼');
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name,asc');
  });

  it('is worked from a keyboard: Tab to it, then Enter or Space', async () => {
    const onSort = header('lastSeenAt,desc');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Name' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onSort).toHaveBeenCalledTimes(2);
  });

  it('keeps the mark out of the name a screen reader reads', () => {
    header('name,asc');
    expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument();
  });
});

/** The URL as the page holds it, for the hook's test. */
function Probe({ param, paged }: Readonly<{ param?: string; paged?: boolean }>) {
  const { sort, setSort } = useUrlSort('lastSeenAt,desc', param, paged);
  const location = useLocation();
  return (
    <div>
      <span data-testid="sort">{sort}</span>
      <span data-testid="search">{location.search}</span>
      <button type="button" onClick={() => setSort('name,asc')}>
        sort by name
      </button>
    </div>
  );
}

describe('useUrlSort', () => {
  it("reads the list's own order until asked, then holds the sort in the URL and starts again at page one", async () => {
    render(
      <MemoryRouter initialEntries={['/list?q=anna&page=3']}>
        <Routes>
          <Route path="/list" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sort')).toHaveTextContent('lastSeenAt,desc');
    await userEvent.click(screen.getByRole('button', { name: 'sort by name' }));
    expect(screen.getByTestId('sort')).toHaveTextContent('name,asc');
    const search = new URLSearchParams(screen.getByTestId('search').textContent ?? '');
    expect(search.get('sort')).toBe('name,asc');
    expect(search.get('q')).toBe('anna');
    expect(search.has('page')).toBe(false);
  });

  it("keeps the page for a table the pager does not page: a source's runs under a page of sources", async () => {
    render(
      <MemoryRouter initialEntries={['/list?sort=name,asc&page=3']}>
        <Routes>
          <Route path="/list" element={<Probe param="runsSort" paged={false} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'sort by name' }));
    const search = new URLSearchParams(screen.getByTestId('search').textContent ?? '');
    expect(search.get('runsSort')).toBe('name,asc');
    expect(search.get('sort')).toBe('name,asc');
    expect(search.get('page')).toBe('3');
  });
});
