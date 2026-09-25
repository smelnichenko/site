/**
 * The masi pages' layout, measured in Chromium with the real stylesheet — what vitest cannot see (jsdom does no
 * layout, and no unit test loads index.css: an empty stylesheet passes every one). Each page, at a phone's width and
 * a desktop's, must hold:
 * - no sideways scroll: after scrollTo(200, 0) the page is still at x 0;
 * - no text past its own box, unless a box scrolls it on purpose (a table's scroller);
 * - every control a finger or a pointer aims at is at least 20 px either way, or has that much room around it,
 *   and every select is the masi control height (36 px), not the browser's bare one;
 * and the calendar's week and day: no two bookings on top of each other, every day's hour grid at the same height.
 */
import { expect, test, type Page } from '@playwright/test';
import { answer } from './fixtures';

const WIDTHS = [390, 1366];
/** A Tuesday morning in Tallinn: the calendar's today, and the fixtures' first day. */
const NOW = new Date('2026-09-22T06:00:00Z');

/** `drawn`: selector -> [at least this many, each/any containing this text] — the fixture's stress, on the page */
type Drawn = Record<string, [number, string?]>;
const UNBROKEN_PART = 'example.com/a/very/long/unbroken';
const PAGES: Array<{ name: string; path: string; ready: string; drawn: Drawn }> = [
  {
    name: 'CV and its translations',
    path: '/masi/cv',
    ready: '[data-testid="cv-translations"]',
    drawn: { '.masi-cv-translations ul.error li': [3, UNBROKEN_PART] },
  },
  {
    name: 'job with its package and match',
    path: '/masi/jobs/7',
    ready: '[data-testid="package-panel"]',
    drawn: { '.masi-lint': [1, UNBROKEN_PART], '.masi-package .error': [1, UNBROKEN_PART] },
  },
  {
    name: 'company with its figures',
    path: '/masi/companies/3',
    ready: '.masi-figures-card',
    // the three charts drawn at a size, not three empty boxes: recharts draws nothing into a box it measured as 0
    drawn: {
      '.masi-figures .recharts-wrapper > svg': [3],
      '.masi-figures-latest dd': [3, '356 (2026 Q2)'],
    },
  },
  { name: 'jobs', path: '/masi/jobs', ready: 'table', drawn: { 'tbody tr': [3, UNBROKEN_PART] } },
  { name: 'packages', path: '/masi/packages', ready: 'table', drawn: { 'tbody tr': [2] } },
  {
    name: 'calendar month',
    path: '/masi/calendar?view=month&day=2026-09-22',
    ready: '.masi-month',
    drawn: { '.masi-month .masi-chip': [8], '.masi-more': [1, '+'] },
  },
  {
    name: 'calendar week',
    path: '/masi/calendar?view=week&day=2026-09-22',
    ready: '.masi-week',
    drawn: { '.masi-block': [4, UNBROKEN_PART] },
  },
  {
    name: 'calendar day',
    path: '/masi/calendar?view=day&day=2026-09-22',
    ready: '.masi-week',
    drawn: { '.masi-block': [4, UNBROKEN_PART] },
  },
];

/** Opens a page with masi answered from the fixtures; returns the API calls no fixture answered. */
async function open(
  page: Page,
  path: string,
  ready: string,
): Promise<{ unanswered: string[]; errors: string[] }> {
  const unanswered: string[] = [];
  const errors: string[] = [];
  let pending = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/')) pending++;
  });
  page.on('requestfinished', (r) => {
    if (r.url().includes('/api/')) pending--;
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) pending--;
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(NOW);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const a = route.request().method() === 'GET' ? answer(url) : undefined;
    if (!a) {
      unanswered.push(`${route.request().method()} ${url.pathname}${url.search}`);
      await route.fulfill({ status: 599, json: { error: 'no fixture' } });
      return;
    }
    // a 204 has no body at all; any other answer is JSON
    await route.fulfill(
      a.status === 204 ? { status: 204 } : { status: a.status, json: a.body ?? {} },
    );
  });
  await page.goto(`/?path=${encodeURIComponent(path)}`);
  await page.locator(ready).first().waitFor();
  // ready means every API call the page made has its answer, and the page has drawn it
  await expect.poll(() => pending).toBe(0);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  return { unanswered, errors };
}

/**
 * The company's figures, read as a reader would: no focus stop inside a chart (its figures are the screen reader's
 * table), words in text colour (the orange is a bar's colour, 3.5:1 on white), the legend in the bars' order, the same
 * year ticks under every chart so a spike in one is read against the same label in the next, no chart alone in half a
 * row (600 px is the width with two columns), and on a phone the line's points over the bars below them and the
 * source line under the title. Axis and baseline: employees up to a little over the most (403 on a 0–600 axis looks
 * flat), a zero line under the bars, where a negative quarter turns.
 */
for (const width of [390, 600, 768, 1366]) {
  test(`company figures read the same on every chart, at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    await open(page, '/masi/companies/3', '.masi-figures-card');
    const m = await page.evaluate(() => {
      const charts = [...document.querySelectorAll('.masi-figures .recharts-wrapper')];
      const centre = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? r.x + r.width / 2 : NaN;
      };
      const grid = document.querySelector('.masi-figures')?.getBoundingClientRect().width ?? 0;
      const figures = [...document.querySelectorAll('.masi-figures > figure')].map((f) =>
        f.getBoundingClientRect(),
      );
      return {
        focusable: document.querySelectorAll('.masi-figures [tabindex]:not([tabindex="-1"])')
          .length,
        legend: [...document.querySelectorAll('.masi-figures .recharts-legend-item-text')].map(
          (e) => ({
            text: e.textContent,
            colour: getComputedStyle(e.querySelector('span') ?? e).color,
          }),
        ),
        ticks: charts.map((c) =>
          [...c.querySelectorAll('.recharts-xAxis-tick-labels text')]
            .map((t) => t.textContent)
            .join('|'),
        ),
        // a figure alone on its row (no other figure at its top) must have the row to itself
        lonely: figures
          .filter((f) => figures.filter((g) => Math.abs(g.top - f.top) < 1).length === 1)
          .map((f) => Math.round(grid - f.width)),
        employeesTop: [
          ...(charts[0]?.querySelectorAll('.recharts-yAxis-tick-labels text') ?? []),
        ].at(-1)?.textContent,
        zeroLines: document.querySelectorAll('.masi-figures .recharts-reference-line').length,
        source: (() => {
          const title = document
            .querySelector('.masi-figures-card .card-title')
            ?.getBoundingClientRect();
          const aside = document.querySelector('.masi-figures-card .card-header-aside');
          return {
            colour: aside ? getComputedStyle(aside).color : '',
            under: !!title && !!aside && aside.getBoundingClientRect().top >= title.bottom - 1,
          };
        })(),
        firstDot: centre(charts[0]?.querySelector('.recharts-line-dots circle') ?? null),
        firstBar: centre(charts[1]?.querySelector('.recharts-bar-rectangle path') ?? null),
      };
    });
    expect(m.focusable, 'no nameless focus stop inside a chart').toBe(0);
    expect(m.legend, 'the legend in the bars order, in text colour').toEqual([
      { text: 'State taxes', colour: 'rgb(51, 51, 51)' },
      { text: 'Labour taxes', colour: 'rgb(51, 51, 51)' },
    ]);
    expect(m.ticks, 'every chart names the same quarters: each year').toEqual(
      Array(3).fill('2022|2023|2024|2025|2026'),
    );
    expect(
      m.lonely.every((spare) => spare === 0),
      'no chart alone in half a row',
    ).toBe(true);
    expect(m.employeesTop, 'employees up to a little over the most, not the next round step').toBe(
      '450',
    );
    expect(m.zeroLines, 'a zero line under each bar chart').toBe(2);
    expect(m.source.colour, 'the source line muted, as every card aside').toBe(
      'rgb(102, 102, 102)',
    );
    if (width === 390) {
      expect(Math.abs(m.firstDot - m.firstBar), 'the line over the bars below it').toBeLessThan(3);
      expect(m.source.under, 'the source line under the title, not squeezed beside it').toBe(true);
    }
    expect(warnings, 'recharts draws without a warning').toEqual([]);
  });
}

for (const { name, path, ready, drawn } of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const { unanswered, errors } = await open(page, path, ready);
      expect(unanswered, 'every API call the page makes has a fixture').toEqual([]);
      expect(errors, 'the page renders without errors').toEqual([]);
      // the premise: the page shows the fixture's hard data, not an empty or failed page that has nothing to spill
      for (const [sel, [min, text]] of Object.entries(drawn)) {
        const texts = await page.locator(sel).allTextContents();
        expect(texts.length, `${sel}: the fixture's rows are drawn`).toBeGreaterThanOrEqual(min);
        if (text) expect(texts.join(' '), `${sel} shows the fixture's hard text`).toContain(text);
      }
      await expect(page.locator('main'), 'no load failure').not.toContainText(/Failed to load/);

      const scrolled = await page.evaluate(() => {
        window.scrollTo(200, 0);
        return {
          x: window.scrollX,
          page: document.documentElement.scrollWidth,
          view: document.documentElement.clientWidth,
        };
      });
      expect(scrolled, 'no sideways scroll').toEqual({
        x: 0,
        page: scrolled.view,
        view: scrolled.view,
      });

      const spilling = await page.evaluate(() => {
        // a box that clips or scrolls its content (a table scroller, a clamp) owns what is past its edge
        const owns = (el: Element) =>
          ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX);
        return [...document.querySelectorAll('main *')]
          .filter(
            (el) =>
              el instanceof HTMLElement && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName),
          )
          .filter((el) => el.getClientRects().length > 0 && !owns(el))
          .filter(
            (el) =>
              (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) ||
              (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0),
          )
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${el.className} ${el.scrollWidth}×${el.scrollHeight} > ${el.clientWidth}×${el.clientHeight}: ${(el.textContent ?? '').slice(0, 50)}`,
          );
      });
      expect(spilling, 'no text past its own box').toEqual([]);

      const tiny = await page.evaluate(() => {
        const targets = [
          ...document.querySelectorAll(
            'main a[href], main button, main select, main input:not([type="hidden"]), main textarea',
          ),
        ]
          .filter((el) => (el as HTMLElement).tabIndex >= 0 && el.getClientRects().length > 0)
          // a link inside a sentence is sized by its text (WCAG 2.5.8's inline exception)
          .filter(
            (el) =>
              !(
                el.tagName === 'A' &&
                el.parentElement &&
                ['P', 'LI', 'SPAN'].includes(el.parentElement.tagName) &&
                getComputedStyle(el).fontSize === getComputedStyle(el.parentElement).fontSize &&
                (el.parentElement.textContent ?? '').trim() !== (el.textContent ?? '').trim()
              ),
          )
          .map((el) => ({ el, r: el.getBoundingClientRect() }));
        const MIN = 20;
        // an undersized target is still fine with room around it: a MIN-sized square on its centre touches no other
        // target (WCAG 2.5.8's spacing exception) — a row's link is, a chip squashed against its neighbour is not
        const small = (r: DOMRect) => r.width < MIN || r.height < MIN;
        const square = (r: DOMRect) => {
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          return {
            left: cx - MIN / 2,
            right: cx + MIN / 2,
            top: cy - MIN / 2,
            bottom: cy + MIN / 2,
          };
        };
        const meet = (
          a: { left: number; right: number; top: number; bottom: number },
          b: typeof a,
        ) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const crowded = (t: { el: Element; r: DOMRect }) =>
          targets.some(
            (o) =>
              o.el !== t.el &&
              !o.el.contains(t.el) &&
              !t.el.contains(o.el) &&
              (meet(square(t.r), o.r) || (small(o.r) && meet(square(t.r), square(o.r)))),
          );
        return targets
          .filter((t) => (t.r.width < MIN || t.r.height < MIN) && crowded(t))
          .map(
            ({ el, r }) =>
              `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}" ${r.width.toFixed(0)}×${r.height.toFixed(0)}`,
          );
      });
      expect(
        tiny,
        'every control is at least 20 px either way, or has that much room around it',
      ).toEqual([]);

      // every select is drawn as masi draws them (36 px, the page's font), not as the browser's bare control
      const bare = await page.evaluate(() =>
        [...document.querySelectorAll('main select')]
          .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height < 36)
          .map(
            (el) =>
              `select "${el.getAttribute('aria-label') ?? el.id}" ${el.getBoundingClientRect().height.toFixed(0)} px`,
          ),
      );
      expect(bare, 'every select is the masi control height').toEqual([]);
    });
  }
}

for (const view of ['week', 'day']) {
  for (const width of WIDTHS) {
    test(`calendar ${view}: bookings never overlap, and every hour grid starts level, at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, `/masi/calendar?view=${view}&day=2026-09-22`, '.masi-week');
      const grid = await page.evaluate(() => {
        const overlaps: string[] = [];
        let blocks = 0;
        for (const slots of document.querySelectorAll('.masi-slots')) {
          const rects = [...slots.querySelectorAll('.masi-block')].map((b) => ({
            t: b.textContent ?? '',
            r: b.getBoundingClientRect(),
          }));
          blocks += rects.length;
          rects.forEach((a, i) =>
            rects.slice(i + 1).forEach((b) => {
              const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
              const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
              if (w > 1 && h > 1) overlaps.push(`"${a.t.slice(0, 20)}" and "${b.t.slice(0, 20)}"`);
            }),
          );
        }
        const tops = [...document.querySelectorAll('.masi-slots')].map((s) =>
          Math.round(s.getBoundingClientRect().top),
        );
        const firstHour = document.querySelector('.masi-hours .masi-hour');
        // 10:00 sits beside 10:00 all the way down, and a booking starts on its own minute of the grid
        const hourTop = new Map(
          [...document.querySelectorAll('.masi-hours .masi-hour')].map((h) => [
            (h.textContent ?? '').trim().slice(0, 2),
            h.getBoundingClientRect(),
          ]),
        );
        const misplaced: string[] = [];
        for (const col of document.querySelectorAll('.masi-slots')) {
          [...col.querySelectorAll('.masi-slot')].forEach((slot, i) => {
            const label = [...hourTop.values()][i];
            const d = Math.abs(slot.getBoundingClientRect().top - label.top);
            if (d > 1)
              misplaced.push(
                `hour ${i}: label ${label.top.toFixed(0)}, row ${slot.getBoundingClientRect().top.toFixed(0)}`,
              );
          });
          for (const b of col.querySelectorAll('.masi-block')) {
            const [hh, mm] = (b.querySelector('.masi-block-time')?.textContent ?? '').split(':');
            const row = hourTop.get(hh);
            if (!row) continue; // started before the grid's first hour: clamped to its top
            const want = row.top + (Number(mm) / 60) * row.height;
            const got = b.getBoundingClientRect().top;
            if (Math.abs(got - want) > 2)
              misplaced.push(
                `${hh}:${mm} booking at ${got.toFixed(0)}, its time at ${want.toFixed(0)}`,
              );
          }
        }
        return {
          misplaced,
          overlaps,
          blocks,
          tops,
          hoursTop: firstHour ? Math.round(firstHour.getBoundingClientRect().top) : null,
        };
      });
      expect(grid.blocks, "the fixture's timed bookings are drawn").toBeGreaterThanOrEqual(4);
      expect(grid.overlaps, 'no two bookings on top of each other').toEqual([]);
      expect(grid.misplaced, 'every hour label beside its row, every booking at its time').toEqual(
        [],
      );
      expect(
        new Set(grid.tops).size,
        `every day's grid starts level: ${grid.tops.join(', ')}`,
      ).toBe(1);
      expect(grid.hoursTop, 'the hour labels start level with the grid').toBe(grid.tops[0]);
    });
  }
}
