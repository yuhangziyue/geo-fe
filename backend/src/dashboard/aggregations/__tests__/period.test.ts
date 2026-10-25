import { describe, expect, it } from 'vitest';
import { TRUTH_PERIOD, TRUTH_TREND } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { halfDelta, MIN_HALF_N, periodDays, periodHalves, visibilityOf } from '../period';

const all = loadQuestions();
const days = periodDays(all);

describe('period halves (F5)', () => {
  it('lists every day of the period in order', () => {
    expect(days).toHaveLength(TRUTH_TREND.days);
    expect(days[0]).toBe(TRUTH_PERIOD.first.from);
    expect(days[days.length - 1]).toBe(TRUTH_PERIOD.last.to);
  });

  it('splits the period into first / last 15 days with their sizes', () => {
    expect(periodHalves(all, days)).toEqual({
      first: { from: TRUTH_PERIOD.first.from, to: TRUTH_PERIOD.first.to, n: TRUTH_PERIOD.first.n },
      last: { from: TRUTH_PERIOD.last.from, to: TRUTH_PERIOD.last.to, n: TRUTH_PERIOD.last.n },
    });
  });

  it('computes the visibility delta in pt', () => {
    expect(halfDelta(all, periodHalves(all, days), visibilityOf)).toBe(TRUTH_PERIOD.deltaPt);
  });

  it('still returns a delta under a platform filter (n ≥ 8 per half)', () => {
    const deepseek = all.filter((q) => q.platform === 'DeepSeek');
    const h = periodHalves(deepseek, days);
    expect(h.first.n).toBeGreaterThanOrEqual(TRUTH_PERIOD.minN);
    expect(h.last.n).toBeGreaterThanOrEqual(TRUTH_PERIOD.minN);
    expect(halfDelta(deepseek, h, visibilityOf)).not.toBeNull();
  });

  it('returns null when a half has fewer than 8 questions', () => {
    expect(MIN_HALF_N).toBe(TRUTH_PERIOD.minN);
    const lastFive = all.filter((q) => q.date >= TRUTH_PERIOD.last.from).slice(0, 5);
    const rows = [...all.filter((q) => q.date <= TRUTH_PERIOD.first.to), ...lastFive];
    const h = periodHalves(rows, days);
    expect(h.last.n).toBe(lastFive.length);
    expect(halfDelta(rows, h, visibilityOf)).toBeNull();
    expect(halfDelta([], periodHalves([], days), visibilityOf)).toBeNull();
  });
});
