/**
 * The masi pages' layout, measured in Chromium with the real stylesheet — what vitest cannot see (jsdom does no
 * layout, and no unit test loads index.css: an empty stylesheet passes every one). Each page, at a phone's width and
 * a desktop's, must hold:
 * - no sideways scroll: after scrollTo(200, 0) the page is still at x 0;
 * - no text past its own box, unless a box scrolls it on purpose (a table's scroller);
 * - every control a finger or a pointer aims at is at least 20 px either way, or has that much room around it;
 * and the calendar's week and day: no two bookings on top of each other, every day's hour grid at the same height.
 */
import { expect, test, type Page } from '@playwright/test';
import { answer } from './fixtures';

const WIDTHS = [390, 1366];
/** A Tuesday morning in Tallinn: the calendar's today, and the fixtures' first day. */
const NOW = new Date('2026-09-22T06:00:00Z');

const PAGES: Array<{ name: string; path: string; ready: string }> = [
  { name: 'CV and its translations', path: '/masi/cv', ready: '[data-testid="cv-translations"]' },
  {
    name: 'job with its package and match',
    path: '/masi/jobs/7',
    ready: '[data-testid="package-panel"]',
  },
  { name: 'jobs', path: '/masi/jobs', ready: 'table' },
  { name: 'packages', path: '/masi/packages', ready: 'table' },
  {
    name: 'calendar month',
    path: '/masi/calendar?view=month&day=2026-09-22',
    ready: '.masi-month',
  },
  { name: 'calendar week', path: '/masi/calendar?view=week&day=2026-09-22', ready: '.masi-week' },
  { name: 'calendar day', path: '/masi/calendar?view=day&day=2026-09-22', ready: '.masi-week' },
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
    await route.fulfill({ status: a.status, json: a.body ?? {} });
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

for (const { name, path, ready } of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const { unanswered, errors } = await open(page, path, ready);
      expect(unanswered, 'every API call the page makes has a fixture').toEqual([]);
      expect(errors, 'the page renders without errors').toEqual([]);

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
        const inOwner = (el: Element) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            if (owns(a)) return true;
          }
          return false;
        };
        return [...document.querySelectorAll('main *')]
          .filter(
            (el) =>
              el instanceof HTMLElement && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName),
          )
          .filter((el) => el.getClientRects().length > 0 && !owns(el) && !inOwner(el))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${el.className} ${el.scrollWidth} > ${el.clientWidth}: ${(el.textContent ?? '').slice(0, 50)}`,
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
                (el.parentElement.textContent ?? '').trim() !== (el.textContent ?? '').trim()
              ),
          )
          .map((el) => ({ el, r: el.getBoundingClientRect() }));
        const MIN = 20;
        // an undersized target is still fine with room around it: a MIN-sized square on its centre touches no other
        // target (WCAG 2.5.8's spacing exception) — a row's link is, a chip squashed against its neighbour is not
        const crowded = (t: { el: Element; r: DOMRect }) => {
          const cx = t.r.left + t.r.width / 2;
          const cy = t.r.top + t.r.height / 2;
          return targets.some(
            (o) =>
              o.el !== t.el &&
              !o.el.contains(t.el) &&
              !t.el.contains(o.el) &&
              o.r.left < cx + MIN / 2 &&
              o.r.right > cx - MIN / 2 &&
              o.r.top < cy + MIN / 2 &&
              o.r.bottom > cy - MIN / 2,
          );
        };
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
        return {
          overlaps,
          blocks,
          tops,
          hoursTop: firstHour ? Math.round(firstHour.getBoundingClientRect().top) : null,
        };
      });
      expect(grid.blocks, "the fixture's timed bookings are drawn").toBeGreaterThanOrEqual(4);
      expect(grid.overlaps, 'no two bookings on top of each other').toEqual([]);
      expect(
        new Set(grid.tops).size,
        `every day's grid starts level: ${grid.tops.join(', ')}`,
      ).toBe(1);
      expect(grid.hoursTop, 'the hour labels start level with the grid').toBe(grid.tops[0]);
    });
  }
}
