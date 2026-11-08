const UNIT_SECONDS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };

/**
 * A duration in seconds: as masi sends it - a Java Duration in ISO-8601 (`PT10M`, `PT720H`, `P30D`, `PT1H30M`) - or as a
 * config writes it (`10m`); null when it is neither.
 */
export function seconds(duration: string): number | null {
  const d = duration.trim();
  const iso = isoSeconds(d);
  if (iso !== null) return iso;
  const short = /^(\d+)\s*([smhd])$/i.exec(d);
  return short ? Number(short[1]) * UNIT_SECONDS[short[2].toLowerCase()] : null;
}

/** `P30D`, `PT720H`, `PT1H30M`, `P1DT2H` in seconds; null when the text is no ISO-8601 duration. */
function isoSeconds(d: string): number | null {
  const m = /^P(?:(\d+)D)?(T.+)?$/i.exec(d);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  let total = m[1] === undefined ? 0 : Number(m[1]) * 86400;
  if (m[2] !== undefined) {
    const time = timeSeconds(m[2].slice(1));
    if (time === null) return null;
    total += time;
  }
  return total;
}

/** The time part of an ISO-8601 duration (`1H30M`), read a character at a time; null when it is anything else. */
function timeSeconds(time: string): number | null {
  let total = 0;
  let digits = '';
  let units = 0;
  for (const ch of time.toLowerCase()) {
    if (ch >= '0' && ch <= '9') {
      digits += ch;
    } else {
      const size = ch === 'd' ? undefined : UNIT_SECONDS[ch];
      if (size === undefined || digits === '') return null;
      total += Number(digits) * size;
      digits = '';
      units++;
    }
  }
  return digits === '' && units > 0 ? total : null;
}

/** A duration in words, the largest units that fit: `PT720H` is "30 days", `PT1H30M` "1 hour 30 minutes"; as given when unreadable. */
export function readable(duration: string): string {
  let left = seconds(duration);
  if (left === null) return duration;
  const parts: string[] = [];
  for (const [unit, size] of [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ] as const) {
    const n = Math.floor(left / size);
    if (n > 0) parts.push(`${n} ${unit}${n === 1 ? '' : 's'}`);
    left -= n * size;
  }
  return parts.length > 0 ? parts.join(' ') : duration;
}

/** A tick's delay as ticks a day: what the waiting backlog is measured against. */
export function perDay(tick: string): number {
  const s = seconds(tick);
  if (s === null || s <= 0) return 24;
  return Math.max(1, Math.floor(86400 / s));
}

/** How many days the waiting contacts take at the lane's own rate, or null when nothing waits or the rate says nothing. */
export function daysToClear(due: number, perTick: number, tick: string): number | null {
  if (due <= 0 || perTick <= 0) return null;
  const aDay = perTick * perDay(tick);
  return aDay <= 0 ? null : Math.ceil(due / aDay);
}
