import { pct } from '../metrics';
import type { Question, TrendPoint } from '../schema';
import { addDays } from './period';

const WINDOW_DAYS = 7;
/**
 * The historical 7-day callers (Overall, intent A/C) draw any full, non-empty window.
 */
const MIN_WINDOW_N = 1;
/** Platform small multiples use a 14-day window with the n ≥ 8 line gate (docs/dashboard-design-optimization-v1.md §3). */
export const PLATFORM_WINDOW_DAYS = 14;
export const PLATFORM_MIN_WINDOW_N = 8;

/**
 * Rolling visibility over `days` (the full period, so a filter keeps the axis). Daily values are kept as
 * faint samples; a day without questions is null, and so is a window that is not full yet, has no questions,
 * or holds fewer than `minWindowN` questions. The numerators (…Mentions / …Questions) are plain counts and are
 * 0, never null, when there is nothing to count.
 */
export function buildTrend(rows: Question[], days: string[], windowDays = WINDOW_DAYS, minWindowN = MIN_WINDOW_N): TrendPoint[] {
  const byDay = new Map<string, { n: number; m: number }>();
  for (const q of rows) {
    const d = byDay.get(q.date) ?? { n: 0, m: 0 };
    byDay.set(q.date, { n: d.n + 1, m: d.m + (q.brand_mentioned ? 1 : 0) });
  }
  return days.map((date, i) => {
    const day = byDay.get(date) ?? { n: 0, m: 0 };
    const from = addDays(date, -(windowDays - 1));
    let rollingN = 0;
    let rollingM = 0;
    for (const [d, v] of byDay) {
      if (d >= from && d <= date) {
        rollingN += v.n;
        rollingM += v.m;
      }
    }
    const full = i >= windowDays - 1;
    return {
      date,
      dailyVisibility: day.n > 0 ? pct(day.m, day.n) : null,
      dailyN: day.n,
      dailyMentions: day.m,
      dailyQuestions: day.n,
      rollingVisibility: full && rollingN >= minWindowN ? pct(rollingM, rollingN) : null,
      rollingN,
      rollingMentions: rollingM,
      rollingQuestions: rollingN,
    };
  });
}
