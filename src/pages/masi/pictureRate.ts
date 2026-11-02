/** A tick's delay (`10m`, `1h`, `30s`) as ticks a day: what the waiting backlog is measured against. */
export function perDay(tick: string): number {
  const m = /^(\d+)\s*([smhd])$/i.exec(tick.trim());
  if (!m) return 24;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (n <= 0) return 24;
  let seconds = n * 86400;
  if (unit === 's') seconds = n;
  else if (unit === 'm') seconds = n * 60;
  else if (unit === 'h') seconds = n * 3600;
  return Math.max(1, Math.floor(86400 / seconds));
}

/** How many days the waiting contacts take at the lane's own rate, or null when nothing waits or the rate says nothing. */
export function daysToClear(due: number, perTick: number, tick: string): number | null {
  if (due <= 0 || perTick <= 0) return null;
  const aDay = perTick * perDay(tick);
  return aDay <= 0 ? null : Math.ceil(due / aDay);
}
