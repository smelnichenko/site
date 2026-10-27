import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

/** Renders a masi page under a router at the given path so links, params and search params work. */
export function renderAt(path: string, route: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
    </MemoryRouter>,
  );
}

export { job, prepared, sendPreview } from './fixtures';

/**
 * Every "·" in a text that a line could start with - one not tied to the part before it by a no-break space - with a
 * little of the text around it, to say where.
 */
export function looseSeparators(text: string | null): string[] {
  if (text == null) {
    return [];
  }
  return [...text.matchAll(/·/g)]
    .filter((m) => text[m.index - 1] !== '\u00a0')
    .map((m) => text.slice(Math.max(0, m.index - 15), m.index + 3));
}
