import { describe, expect, it } from 'vitest';
import { TRUTH_FUNNEL, TRUTH_OWNED_SHARE, TRUTH_PERIOD, TRUTH_SOURCE_BACKED } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { buildFunnel } from '../funnel';
import { periodDays, periodHalves } from '../period';

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
});
