import { describe, expect, it } from 'vitest';
import { TRUTH_TREND } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { periodDays } from '../period';
import { buildTrend } from '../trend';

const all = loadQuestions();
const days = periodDays(all);

describe('buildTrend — 7-day rolling visibility', () => {
  const trend = buildTrend(all, days);

  it('has one point per day of the period', () => {
    expect(trend).toHaveLength(TRUTH_TREND.days);
  });

  it('has no rolling value until the window is full', () => {
    for (const p of trend.slice(0, TRUTH_TREND.leadingNullDays)) expect(p.rollingVisibility).toBeNull();
    expect(trend[TRUTH_TREND.leadingNullDays].rollingVisibility).not.toBeNull();
  });

  it('matches the rolling truths (8-07 and 8-30)', () => {
    for (const w of TRUTH_TREND.rolling) {
      expect(trend.find((p) => p.date === w.date)).toMatchObject({ rollingVisibility: w.pct, rollingN: w.n });
    }
  });

  it('carries the numerators behind the tooltips (05 §2.5): rolling 22/28 on 8-07, 20/28 on 8-30', () => {
    for (const w of TRUTH_TREND.rolling) {
      expect(trend.find((p) => p.date === w.date)).toMatchObject({ rollingMentions: w.mentions, rollingQuestions: w.n });
    }
  });

  it('carries the daily numerators: "Aug 4 · 4/4 mentioned (n=4)"', () => {
    for (const d of TRUTH_TREND.daily) {
      expect(trend.find((p) => p.date === d.date)).toMatchObject({ dailyMentions: d.mentions, dailyQuestions: d.n, dailyVisibility: d.pct });
    }
  });

  it('daily samples are always n=4, so daily visibility is a multiple of 25', () => {
    const steps = Array.from({ length: TRUTH_TREND.dailyN + 1 }, (_, i) => (i * 100) / TRUTH_TREND.dailyN);
    for (const p of trend) {
      expect(p.dailyN).toBe(TRUTH_TREND.dailyN);
      expect(steps).toContain(p.dailyVisibility);
    }
  });

  it('keeps every day under a filter: empty days are null, not 0%', () => {
    const one = all.find((q) => q.date === days[10])!;
    const t = buildTrend([one], days);
    expect(t).toHaveLength(TRUTH_TREND.days);
    expect(t[0]).toMatchObject({
      dailyVisibility: null, dailyN: 0, dailyMentions: 0, dailyQuestions: 0,
      rollingVisibility: null, rollingN: 0, rollingMentions: 0, rollingQuestions: 0,
    });
    expect(t[10]).toMatchObject({ dailyMentions: Number(one.brand_mentioned), dailyQuestions: 1 });
    expect(t[10].dailyN).toBe(1);
    expect(t[10].rollingN).toBe(1);
    expect(t[10].rollingVisibility).not.toBeNull();
    // the window ending 7 days later no longer contains that run
    expect(t[17]).toMatchObject({ rollingN: 0, rollingVisibility: null, rollingMentions: 0, rollingQuestions: 0 });
  });
});
