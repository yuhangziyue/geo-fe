import { pct } from '../metrics';
import type { Question, TrendPoint } from '../schema';
import { addDays } from './period';

const WINDOW_DAYS = 7;

/**
 * 7-day rolling visibility over `days` (the full period, so a filter keeps the axis). Daily values are kept as
 * faint samples; a day without questions is null, and so is a window that is not full yet or has no questions.
 */
export function buildTrend(rows: Question[], days: string[]): TrendPoint[] {
  const byDay = new Map<string, { n: number; m: number }>();
  for (const q of rows) {
    const d = byDay.get(q.date) ?? { n: 0, m: 0 };
    byDay.set(q.date, { n: d.n + 1, m: d.m + (q.brand_mentioned ? 1 : 0) });
  }
  return days.map((date, i) => {
    const day = byDay.get(date) ?? { n: 0, m: 0 };
    const from = addDays(date, -(WINDOW_DAYS - 1));
    let rollingN = 0;
    let rollingM = 0;
    for (const [d, v] of byDay) {
      if (d >= from && d <= date) {
        rollingN += v.n;
        rollingM += v.m;
      }
    }
    const full = i >= WINDOW_DAYS - 1;
    return {
      date,
      dailyVisibility: day.n > 0 ? pct(day.m, day.n) : null,
      dailyN: day.n,
      rollingVisibility: full && rollingN > 0 ? pct(rollingM, rollingN) : null,
      rollingN,
    };
  });
}
