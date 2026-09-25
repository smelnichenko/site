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
    await route.fulfill({ status: a.status, json: a.body ?? {} });
  });
  await page.goto(`/?path=${encodeURIComponent(path)}`);
  // a page that never draws names the call it made that no fixture answers, not only the selector it waited for
  await page
    .locator(ready)
    .first()
    .waitFor({ timeout: 10_000 })
    .catch((e: unknown) => {
      throw new Error(`${ready} was never drawn; unanswered: ${unanswered.join(', ') || 'none'}`, {
        cause: e,
      });
    });
  // ready means every API call the page made has its answer, and the page has drawn it
  await expect.poll(() => pending).toBe(0);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  return { unanswered, errors };
}

/**
 * The company's figures, read as a reader would: no focus stop inside a chart (its figures are the screen reader's
 * table), words in text colour (the orange is a bar's colour, 3.5:1 on white), the legends and the tooltips in the
 * bars' order and the tooltips to the euro, the same year ticks under every quarterly chart so a spike in one is read
 * against the same label in the next, each chart plotting its own figure, every row of charts reaching the grid's right
 * edge (600 and 768 px have two columns; 960 px is three in a grid just wider than 872 px, where two would end), bars no
 * thinner than 3 px, the annual reports' headcount a dashed line of three points on the employees chart and their
 * money a chart by year below the grid, and on a phone every point over the bar below it, the source line under the
 * title and each latest figure on one line. NORTAL AS: 403 at the most, on a 0–500 axis.
 */
for (const width of [390, 600, 768, 960, 1366]) {
  test(`company figures read the same on every chart, at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    await open(page, '/masi/companies/3', '.masi-figures-card');
    const m = await page.evaluate(measureFigures);
    expect(m.focusable, 'no nameless focus stop inside a chart').toBe(0);
    const inText = (texts: string[]) => texts.map((text) => ({ text, colour: 'rgb(51, 51, 51)' }));
    expect(m.legends, 'the legends in the lines and bars order, in text colour').toEqual([
      inText(['Employees', 'Annual average (FTE)']),
      inText(['State taxes', 'Labour taxes']),
      inText(['Revenue', 'Operating profit', 'Profit']),
    ]);
    expect(
      m.annual,
      "the annual reports' headcount a dashed line in a hue of its own, dashed in the legend too",
    ).toEqual({
      stroke: 'rgb(179, 89, 0)',
      dashed: '6 4',
      iconDashed: '6 4',
    });
    expect(m.captions, 'every chart captioned alike').toEqual(Array(4).fill('600'));
    expect(m.years.xTicks, 'the chart by year names each financial year').toBe('2023|2024|2025');
    expect(m.years.yTicks, 'and plots their money').toBe('0|20M|40M|60M|80M');
    expect(m.years.zeroOnAxis, 'its zero line on the 0 tick').toBe(true);
    expect(m.years.thinnestBar, 'no year bar thinner than 3 px').toBeGreaterThanOrEqual(3);
    expect(
      m.years.thickestBar,
      'no year bar wider than a quarter would be read as',
    ).toBeLessThanOrEqual(48);
    expect(m.latest, 'the latest of each figure, the years as well').toEqual([
      '356 (2026 Q2)',
      '14.9M € (2026 Q2)',
      '3.7M € (2026 Q2)',
      '64.4M € (2025)',
      '7.1M € (2025)',
    ]);
    expect(m.xTicks, 'every chart names the same quarters: each year').toEqual(
      Array(3).fill('2022|2023|2024|2025|2026'),
    );
    expect(m.yTicks, 'each chart plots its own figure').toEqual([
      '0|100|200|300|400|500',
      '0|20M|40M|60M|80M',
      '0|1.5M|3M|4.5M|6M',
    ]);
    expect(m.stateOverLabour, "NORTAL's state taxes bar is the taller in every quarter").toBe(true);
    expect(m.rowGaps, 'every row of charts reaches the grid right edge').toEqual(
      m.rowGaps.map(() => 0),
    );
    expect(m.thinnestBar, 'no bar thinner than 3 px').toBeGreaterThanOrEqual(3);
    expect(m.zeroOnAxis, 'the zero line on the 0 tick').toEqual([true, true]);
    expect(m.sources.stacked, 'one source under the other, however wide').toBe(true);
    expect(m.source.colour, 'the source line muted, as every card aside').toBe(
      'rgb(102, 102, 102)',
    );
    if (width === 390) {
      expect(m.dotOverBar, 'every point over the bar below it').toBeLessThan(3);
      expect(m.source.under, 'the source line under the title, not squeezed beside it').toBe(true);
      expect(m.tallestLatest, 'each latest figure on one line').toBeLessThan(30);
    }
    // the taxes tooltip over the first quarter: the bars' order, to the euro (the svg takes the pointer, so the mouse)
    const bar = page
      .locator('.masi-figures .recharts-wrapper')
      .nth(2)
      .locator('.recharts-bar-rectangle path')
      .first();
    await bar.scrollIntoViewIfNeeded();
    const box = await bar.boundingBox();
    if (!box) throw new Error('the first taxes bar is not drawn');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tooltip = page
      .locator('.masi-figures .recharts-wrapper')
      .nth(2)
      .locator('.recharts-tooltip-item');
    await expect(tooltip, 'the tooltip in the bars order, to the euro').toHaveText([
      'State taxes : 3,264,450 €',
      'Labour taxes : 2,095,885 €',
    ]);
    // the employees' tooltip over 2025 Q4, where both lines have a value: the count first, the year's average after it
    const dot = page
      .locator('.masi-figures .recharts-wrapper')
      .first()
      .locator('.recharts-line-dots')
      .first()
      .locator('circle')
      .nth(15);
    await dot.scrollIntoViewIfNeeded();
    const dotBox = await dot.boundingBox();
    if (!dotBox) throw new Error('the 2025 Q4 point is not drawn');
    await page.mouse.move(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2);
    await expect(
      page.locator('.masi-figures .recharts-wrapper').first().locator('.recharts-tooltip-item'),
      "the employees' tooltip in the lines' order",
    ).toHaveText(['Employees : 357', 'Annual average (FTE) : 361']);
    // and the years' tooltip over the first year: the bars' order, to the euro
    const yearBar = page.locator('.masi-figures-years .recharts-bar-rectangle path').first();
    await yearBar.scrollIntoViewIfNeeded();
    const yearBox = await yearBar.boundingBox();
    if (!yearBox) throw new Error('the first year bar is not drawn');
    await page.mouse.move(yearBox.x + yearBox.width / 2, yearBox.y + yearBox.height / 2);
    await expect(
      page.locator('.masi-figures-years .recharts-tooltip-item'),
      "the years' tooltip in the bars order, to the euro",
    ).toHaveText([
      'Revenue : 66,191,000 €',
      'Operating profit : 5,352,000 €',
      'Profit : 11,509,000 €',
    ]);
    for (const item of await page.locator('.recharts-tooltip-item').all()) {
      await expect(item, 'tooltip words in text colour').toHaveCSS('color', 'rgb(51, 51, 51)');
    }
    await expect(
      page.locator('.masi-figures-years .recharts-default-tooltip'),
      'a tooltip small enough not to cover the years on a phone',
    ).toHaveCSS('font-size', '12px');
    expect(warnings, 'recharts draws without a warning').toEqual([]);
  });
}

/**
 * A company of three people (ANTERAS BALTIC OÜ, as published): its line fills the chart (0–4, not 0–50), breaks where
 * a quarter has no count (2025 Q2) instead of joining over it, and the negative quarter (2025 Q1) is a bar below the
 * zero line, which sits on the 0 tick above the axis.
 */
test('a small company: its own scale, a gap where a count is missing, a bar below zero', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page, '/masi/companies/4', '.masi-figures-card');
  const m = await page.evaluate(measureFigures);
  expect(m.yTicks[0], 'employees on their own scale').toBe('0|1|2|3|4');
  expect(m.lineSegments, 'the line breaks at the missing count').toBe(2);
  expect(m.zeroOnAxis, 'the zero line on the 0 tick').toEqual([true, true]);
  expect(m.belowZero, "the negative quarter's bar hangs below the zero line").toBe(1);
  // its 2023 profit of 1 048 € beside a revenue of 137 630 €: a bar of a pixel reads as none
  expect(m.years.shortestBar, 'no year bar too short to see').toBeGreaterThanOrEqual(2);
});

/**
 * A company in no quarterly file of the board (10002603, dormant since 2022, as published): its six years alone, named
 * by when they end — every label that fits, none over another, the first and the last always — its losses hanging below
 * the zero line, its headcount among the latest figures from the annual reports, and only that source named.
 */
for (const width of [390, 1366]) {
  test(`a company with annual reports only, at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/masi/companies/7', '.masi-figures-card');
    const m = await page.evaluate(measureFigures);
    expect(m.quarterlyCharts, 'no quarterly charts').toBe(0);
    expect(m.sourceSpans).toEqual(['e-Business Register annual reports']);
    expect(m.latest).toEqual(['0 (2024)', '0 € (2024)', '0 € (2024)']);
    expect(m.yearTickOverlap, 'no year label over another').toBe(false);
    expect(
      m.years.xTicks.startsWith('2019') && m.years.xTicks.endsWith('2024'),
      m.years.xTicks,
    ).toBe(true);
    expect(m.years.zeroOnAxis, 'the zero line on the 0 tick').toBe(true);
    // 2020 and 2021: an operating loss and a loss each
    expect(m.yearBelowZero, 'the losses hang below the zero line').toBe(4);
  });
}

/**
 * Years that are not the calendar's, beside the quarters. HORTICOM OÜ's years end in July (the first in August): each
 * year's average is held from the quarter after the previous year's end to the quarter of its own, so the dashed step
 * takes each new level in the first quarter after a year's end (2022 Q4, 2023 Q4, 2024 Q4) and stops at the last
 * year's end (2025 Q3).
 * ARTISTON, OÜ filed no report for 2024 — it moved to calendar years, its next report covering 18 months — so its line
 * breaks there, and its years are named by when they end (Jun 2020 …), not by the register's label (2019 …).
 */
for (const width of [390, 1366]) {
  test(`company years that end in July: a step at each year end, straight across its quarters, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/masi/companies/5', '.masi-figures-card');
    const m = await page.evaluate(measureFigures);
    // seven labels on a phone: every label that fits, none over another, the first and the last always
    expect(m.yearTickOverlap, 'no year label over another').toBe(false);
    expect(m.years.xTicks.endsWith('Jul 2025'), m.years.xTicks).toBe(true);
    const { dots, steps, first, last, moves, curves } = m.annualPath;
    const at = (i: number) => dots[i];
    expect(moves, 'one unbroken line').toBe(1);
    expect(curves, 'straight steps, no curves').toBe(false);
    expect(first, 'from the first quarter on the axis (2022 Q1)').toBeCloseTo(at(0), 0);
    expect(last, "to the last year's end (2025 Q3)").toBeCloseTo(at(14), 0);
    expect(steps.length, 'a step at each year end').toBe(3);
    // the new level from the first quarter after each year's end: 2022 Q4, 2023 Q4, 2024 Q4
    steps.forEach((x, i) => expect(x, `step ${i + 1}`).toBeCloseTo(at(3 + 4 * i), 0));
    expect(m.years.xTicks.split('|')[0], 'the first year ends in August').toBe('Aug 2019');
  });
}

for (const width of [390, 1366]) {
  test(`company without a report for a year: the line breaks, years named by when they end, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/masi/companies/6', '.masi-figures-card');
    const m = await page.evaluate(measureFigures);
    expect(m.annualPath.moves, 'broken where 2024 has no report').toBe(2);
    if (width === 1366) {
      expect(m.years.xTicks).toBe('Jun 2020|Jun 2021|Jun 2022|Jun 2023|Jun 2024|2025');
    } else {
      // six labels thinned on a phone: the first and the last always, none over another
      const ticks = m.years.xTicks.split('|');
      expect([ticks[0], ticks[ticks.length - 1]], m.years.xTicks).toEqual(['Jun 2020', '2025']);
      expect(m.yearTickOverlap, 'no year label over another').toBe(false);
    }
  });
}

/**
 * The source line on a phone's range of widths: each source its own line, no separator to start a wrapped one, and the
 * file's date never broken (at 412–460 px it broke inside "10 Jul 2026" before).
 */
test('company sources: one under the other, the date whole, at 360–480 px', async ({ page }) => {
  for (const width of [360, 390, 412, 430, 440, 460, 480]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/masi/companies/3', '.masi-figures-card');
    const m = await page.evaluate(measureFigures);
    expect(m.sources.stacked, `${width} px: one source under the other`).toBe(true);
    expect(m.sources.separators, `${width} px: no separator`).toEqual(['none', 'none']);
    expect(m.sources.dateLines, `${width} px: the date on one line`).toBe(1);
  }
});

/** What the figures card draws, as numbers the tests compare. */
function measureFigures() {
  const charts = [...document.querySelectorAll('.masi-figures .recharts-wrapper')];
  const yearChart = document.querySelector('.masi-figures-years .recharts-wrapper');
  const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.x + r.width / 2;
  };
  const texts = (c: Element | undefined, sel: string) =>
    [...(c?.querySelectorAll(sel) ?? [])].map((t) => t.textContent).join('|');
  const bars = (c: Element | undefined) => [
    ...(c?.querySelectorAll('.recharts-bar-rectangle path') ?? []),
  ];
  const grid = document.querySelector('.masi-figures')?.getBoundingClientRect();
  const figures = [...document.querySelectorAll('.masi-figures > figure')].map((f) =>
    f.getBoundingClientRect(),
  );
  const tops = [...new Set(figures.map((f) => Math.round(f.top)))];
  const dots = [
    ...(charts[0]?.querySelectorAll('.recharts-line-dots')[0]?.querySelectorAll('circle') ?? []),
  ].map(centre);
  const turnover = bars(charts[1]).map(centre);
  const series = [...(charts[2]?.querySelectorAll('.recharts-bar') ?? [])].map((g) =>
    [...g.querySelectorAll('.recharts-bar-rectangle path')].map(
      (p) => p.getBoundingClientRect().height,
    ),
  );
  const title = document.querySelector('.masi-figures-card .card-title')?.getBoundingClientRect();
  const aside = document.querySelector('.masi-figures-card .card-header-aside');
  // the 0 tick's y in a chart, and its zero line's
  const zero = (c: Element | null | undefined) => {
    const tick = [...(c?.querySelectorAll('.recharts-yAxis-tick-labels text') ?? [])].find(
      (t) => t.textContent === '0',
    );
    const line = c?.querySelector('.recharts-reference-line line');
    const t = tick?.getBoundingClientRect();
    const l = line?.getBoundingClientRect();
    return { tick: t ? t.y + t.height / 2 : NaN, line: l ? l.y : NaN };
  };
  const zeros = charts.slice(1).map(zero);
  const zeroOf = (c: Element | null) => {
    const z = zero(c);
    return Math.abs(z.tick - z.line) < 2;
  };
  return {
    focusable: document.querySelectorAll('.masi-figures-card [tabindex]:not([tabindex="-1"])')
      .length,
    legends: [charts[0], charts[2], yearChart].map((c) =>
      [...(c?.querySelectorAll('.recharts-legend-item-text') ?? [])].map((e) => ({
        text: e.textContent,
        colour: getComputedStyle(e.querySelector('span') ?? e).color,
      })),
    ),
    annualPath: (() => {
      const d = charts[0]?.querySelectorAll('.recharts-line-curve')[1]?.getAttribute('d') ?? '';
      const moves = (d.match(/M/g) ?? []).length;
      const points = d
        .split(/[ML]/)
        .filter((p) => p.includes(','))
        .map((p) => p.split(',').map(Number));
      // a step: two points one above the other
      const steps = points
        .filter(
          (p, i) =>
            i > 0 &&
            Math.abs(p[0] - points[i - 1][0]) < 0.5 &&
            Math.abs(p[1] - points[i - 1][1]) > 0.5,
        )
        .map((p) => p[0]);
      const dots = [
        ...(charts[0]?.querySelectorAll('.recharts-line-dots')[0]?.querySelectorAll('circle') ??
          []),
      ].map((c) => Number(c.getAttribute('cx')));
      return {
        moves,
        // steps are straight: a curve between two years would slope through quarters no year held
        curves: /[CQSA]/i.test(d),
        first: points[0]?.[0],
        last: points[points.length - 1]?.[0],
        steps,
        dots,
      };
    })(),
    annual: (() => {
      const curve = charts[0]?.querySelectorAll('.recharts-line-curve')[1];
      const icon = charts[0]
        ?.querySelectorAll('.recharts-legend-item')[1]
        ?.querySelector('path, line');
      return {
        stroke: curve ? getComputedStyle(curve).stroke : '',
        dashed: curve?.getAttribute('stroke-dasharray') ?? '',
        iconDashed: icon?.getAttribute('stroke-dasharray') ?? '',
      };
    })(),
    yearTickOverlap: (() => {
      const boxes = [
        ...(yearChart?.querySelectorAll('.recharts-xAxis-tick-labels text') ?? []),
      ].map((t) => t.getBoundingClientRect());
      return boxes.some((b, i) => i > 0 && b.left < boxes[i - 1].right);
    })(),
    yearBelowZero: bars(yearChart ?? undefined).filter(
      (p) => p.getBoundingClientRect().top >= zero(yearChart).line - 1,
    ).length,
    sourceSpans: [...document.querySelectorAll('.masi-figures-card .card-header-aside > span')].map(
      (e) => e.textContent,
    ),
    sources: (() => {
      const spans = [...document.querySelectorAll('.masi-figures-card .card-header-aside > span')];
      const date = document.querySelector('.masi-figures-card .card-header-aside .nowrap');
      const range = document.createRange();
      if (date) range.selectNodeContents(date);
      return {
        separators: spans.map((e) => getComputedStyle(e, '::before').content),
        stacked: spans.every(
          (e, i) =>
            i === 0 ||
            e.getBoundingClientRect().top >= spans[i - 1].getBoundingClientRect().bottom - 1,
        ),
        dateLines: date ? range.getClientRects().length : 0,
      };
    })(),
    quarterlyCharts: charts.length,
    years: {
      xTicks: texts(yearChart ?? undefined, '.recharts-xAxis-tick-labels text'),
      yTicks: texts(yearChart ?? undefined, '.recharts-yAxis-tick-labels text'),
      zeroOnAxis: zeroOf(yearChart),
      thinnestBar: Math.min(
        ...bars(yearChart ?? undefined).map((p) => p.getBoundingClientRect().width),
      ),
      thickestBar: Math.max(
        ...bars(yearChart ?? undefined).map((p) => p.getBoundingClientRect().width),
      ),
      shortestBar: Math.min(
        ...bars(yearChart ?? undefined).map((p) => p.getBoundingClientRect().height),
      ),
    },
    latest: [...document.querySelectorAll('.masi-figures-latest dd')].map((d) => d.textContent),
    captions: [...document.querySelectorAll('.masi-figures-card figcaption')].map(
      (c) => getComputedStyle(c).fontWeight,
    ),
    xTicks: charts.map((c) => texts(c, '.recharts-xAxis-tick-labels text')),
    yTicks: charts.map((c) => texts(c, '.recharts-yAxis-tick-labels text')),
    stateOverLabour:
      series.length === 2 && series[0].length > 0 && series[0].every((h, i) => h > series[1][i]),
    rowGaps: grid
      ? tops.map((t) =>
          Math.round(
            grid.right -
              Math.max(...figures.filter((f) => Math.round(f.top) === t).map((f) => f.right)),
          ),
        )
      : [NaN],
    thinnestBar: Math.min(
      ...charts.slice(1).flatMap((c) => bars(c).map((p) => p.getBoundingClientRect().width)),
    ),
    dotOverBar:
      dots.length > 0 && dots.length === turnover.length
        ? Math.max(...dots.map((d, i) => Math.abs(d - turnover[i])))
        : NaN,
    zeroOnAxis: zeros.map((z) => Math.abs(z.tick - z.line) < 2),
    belowZero: bars(charts[1]).filter((p) => p.getBoundingClientRect().top >= zeros[0].line - 1)
      .length,
    lineSegments: (
      charts[0]?.querySelector('.recharts-line-curve')?.getAttribute('d')?.match(/M/g) ?? []
    ).length,
    tallestLatest: Math.max(
      ...[...document.querySelectorAll('.masi-figures-latest dd')].map(
        (d) => d.getBoundingClientRect().height,
      ),
    ),
    source: {
      colour: aside ? getComputedStyle(aside).color : '',
      under: !!title && !!aside && aside.getBoundingClientRect().top >= title.bottom - 1,
    },
  };
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
