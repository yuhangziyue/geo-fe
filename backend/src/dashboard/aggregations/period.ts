import { pct } from '../metrics';
import type { PeriodHalves, Question } from '../schema';

/** Below this many questions in either half, a period delta is not shown ("Too few samples", 05 §1). */
export const MIN_HALF_N = 8;
/** Source-backed (÷ mentions) delta also needs this many mentions in each half (round-1 ruling M2). */
export const MIN_HALF_MENTIONS = 8;
/** Owned share (÷ citations) delta also needs this many citations in each half (round-1 ruling M2). */
export const MIN_HALF_CITATIONS = 10;

/** Extra per-half sample rule for a rate whose denominator is not the question count. */
export interface HalfGate {
  size: (rows: Question[]) => number;
  min: number;
}

const DAY_MS = 86_400_000;
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Shift a YYYY-MM-DD date by whole days. */
export const addDays = (iso: string, days: number) => fromDay(toDay(iso) + days * DAY_MS);

/**
 * Every calendar day of the reporting period (first to last date of the FULL data), so filtered views keep the
 * same x-axis and the same halves. Empty data → [].
 */
export function periodDays(all: Question[]): string[] {
  if (all.length === 0) return [];
  const dates = all.map((q) => q.date).sort();
  const out: string[] = [];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) out.push(d);
  return out;
}

/** First / last half of the period (15 + 15 days on the data), with the number of `rows` in each. */
export function periodHalves(rows: Question[], days: string[]): PeriodHalves {
  const mid = Math.floor(days.length / 2);
  const first = { from: days[0] ?? '', to: days[mid - 1] ?? '' };
  const last = { from: days[mid] ?? '', to: days[days.length - 1] ?? '' };
  const count = (h: { from: string; to: string }) => rows.filter((q) => q.date >= h.from && q.date <= h.to).length;
  return { first: { ...first, n: count(first) }, last: { ...last, n: count(last) } };
}

export const inHalf = (rows: Question[], h: { from: string; to: string }) => rows.filter((q) => q.date >= h.from && q.date <= h.to);

/** Visibility = mentions ÷ questions, in pct. */
export const visibilityOf = (rows: Question[]) => pct(rows.filter((q) => q.brand_mentioned).length, rows.length);

/**
 * metric(last half) − metric(first half) in pt; null ("Too few samples") when either half has fewer than
 * MIN_HALF_N questions, or — with a gate — fewer than `gate.min` of the metric's own denominator.
 */
export function halfDelta(
  rows: Question[],
  halves: PeriodHalves,
  metric: (rows: Question[]) => number,
  gate?: HalfGate,
): number | null {
  if (halves.first.n < MIN_HALF_N || halves.last.n < MIN_HALF_N) return null;
  const first = inHalf(rows, halves.first);
  const last = inHalf(rows, halves.last);
  if (gate && (gate.size(first) < gate.min || gate.size(last) < gate.min)) return null;
  return metric(last) - metric(first);
}
