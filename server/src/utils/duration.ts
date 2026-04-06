/** Parse simple duration strings like 15m, 7d, 24h to milliseconds */
export function parseDurationToMs(s: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(s.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const u = m[2];
  const table: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return n * (table[u] ?? 24 * 60 * 60 * 1000);
}
