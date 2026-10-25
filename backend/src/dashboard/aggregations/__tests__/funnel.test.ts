import { describe, expect, it } from 'vitest';
import { TRUTH_FUNNEL, TRUTH_OWNED_SHARE, TRUTH_PERIOD, TRUTH_SOURCE_BACKED } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { buildFunnel } from '../funnel';
import { MIN_HALF_CITATIONS, MIN_HALF_MENTIONS, periodDays, periodHalves } from '../period';

const all = loadQuestions();
const days = periodDays(all);

describe('buildFunnel', () => {
  const f = buildFunnel(all, periodHalves(all, days));
  const firstRows = all.filter((q) => q.date <= TRUTH_PERIOD.first.to);
  const lastRows = all.filter((q) => q.date >= TRUTH_PERIOD.last.from);
  const half = (rows: typeof all) => buildFunnel(rows, periodHalves(rows, days));

  it('builds the nested funnel Asked → Mentioned → Recommended', () => {
    expect(f.questions).toEqual({ value: TRUTH_FUNNEL.questions });
    expect(f.mentions).toMatchObject(TRUTH_FUNNEL.mentions);
    expect(f.recommendations).toMatchObject(TRUTH_FUNNEL.recommendations);
  });

  it('has the two side metrics, not nested', () => {
    expect(f.sourceBacked).toMatchObject({ cited: TRUTH_SOURCE_BACKED.cited, rateOfMentioned: TRUTH_SOURCE_BACKED.rateOfMentioned });
    expect(f.ownedSource).toMatchObject({ ...TRUTH_OWNED_SHARE });
  });

  it('mentions delta is last 15 − first 15 days (▼ 12 pt)', () => {
    expect(f.mentions.deltaPt).toBe(TRUTH_PERIOD.deltaPt);
  });

  it('every other delta is the same metric on the last half minus the first half', () => {
    const a = half(firstRows);
    const b = half(lastRows);
    expect(f.recommendations.deltaPt).toBe(b.recommendations.rateOfAsked - a.recommendations.rateOfAsked);
    expect(f.sourceBacked.deltaPt).toBe(b.sourceBacked.rateOfMentioned - a.sourceBacked.rateOfMentioned);
    expect(f.ownedSource.deltaPt).toBe(b.ownedSource.shareOfCitations - a.ownedSource.shareOfCitations);
  });

  it('has no deltas when a half is too small, and zeros on no rows', () => {
    const z = buildFunnel([], periodHalves([], days));
    expect(z).toEqual({
      questions: { value: 0 },
      mentions: { value: 0, rateOfAsked: 0, rateOfPrevious: 0, deltaPt: null },
      recommendations: { value: 0, rateOfAsked: 0, rateOfPrevious: 0, deltaPt: null },
      sourceBacked: { cited: 0, rateOfMentioned: 0, deltaPt: null },
      ownedSource: { owned: 0, totalCitations: 0, shareOfCitations: 0, deltaPt: null },
    });
    expect(half(firstRows).mentions.deltaPt).toBeNull();
  });

  /*
   * M2 gates (coordinator ruling, round 1): a side-metric delta also needs enough of its own denominator per half.
   * Per-half sizes, recomputed by script from questions.json (first 15 days / last 15 days):
   *   all       mentions 46 / 39   citations 40 / 31   → both deltas shown
   *   DeepSeek  mentions  7 / 4    citations  3 / 6    → both null, while the mentions delta (n 11 / 13) is shown
   * The test recomputes the sizes from the rows instead of typing them, and checks them against the gates.
   */
  const perHalf = (rows: typeof all) =>
    [rows.filter((q) => q.date <= TRUTH_PERIOD.first.to), rows.filter((q) => q.date >= TRUTH_PERIOD.last.from)].map((h) => ({
      mentions: h.filter((q) => q.brand_mentioned).length,
      citations: h.reduce((n, q) => n + q.citations.length, 0),
    }));

  it('shows the side-metric deltas when both halves have enough mentions / citations', () => {
    for (const h of perHalf(all)) {
      expect(h.mentions).toBeGreaterThanOrEqual(MIN_HALF_MENTIONS);
      expect(h.citations).toBeGreaterThanOrEqual(MIN_HALF_CITATIONS);
    }
    expect(f.sourceBacked.deltaPt).not.toBeNull();
    expect(f.ownedSource.deltaPt).not.toBeNull();
  });

  it('hides them (too few samples) when a half has < 8 mentions or < 10 citations, question count alone is not enough', () => {
    const deepseek = all.filter((q) => q.platform === 'DeepSeek');
    const halves = periodHalves(deepseek, days);
    expect(Math.min(halves.first.n, halves.last.n)).toBeGreaterThanOrEqual(TRUTH_PERIOD.minN);
    const sizes = perHalf(deepseek);
    expect(Math.min(...sizes.map((h) => h.mentions))).toBeLessThan(MIN_HALF_MENTIONS);
    expect(Math.min(...sizes.map((h) => h.citations))).toBeLessThan(MIN_HALF_CITATIONS);
    const d = buildFunnel(deepseek, halves);
    expect(d.mentions.deltaPt).not.toBeNull();
    expect(d.sourceBacked.deltaPt).toBeNull();
    expect(d.ownedSource.deltaPt).toBeNull();
  });

  it('gates are 8 mentions and 10 citations per half', () => {
    expect(MIN_HALF_MENTIONS).toBe(TRUTH_PERIOD.minN);
    expect(MIN_HALF_CITATIONS).toBe(10);
  });
});
