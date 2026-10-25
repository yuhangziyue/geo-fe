import { describe, expect, it } from 'vitest';
import { TRUTH_OWNED_SHARE, TRUTH_PLATFORMS, TRUTH_SOURCE_TYPES, TRUTH_TOP_DOMAINS } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { sourceStructure } from '../sources';

const all = loadQuestions();

describe('sourceStructure', () => {
  const s = sourceStructure(all);

  it('counts source_type labels, count desc', () => {
    expect(s.byType).toEqual(TRUTH_SOURCE_TYPES.map((t) => ({ ...t })));
  });

  it('computes the owned share of citations by domain', () => {
    expect(s.ownedShare).toEqual({ ...TRUTH_OWNED_SHARE });
  });

  it('ranks top domains by count and flags the owned one (tied tail compared as a set)', () => {
    expect(s.topDomains[0]).toEqual(TRUTH_TOP_DOMAINS[0]);
    const n = TRUTH_TOP_DOMAINS.length;
    expect(s.topDomains.slice(0, n - 2)).toEqual(TRUTH_TOP_DOMAINS.slice(0, n - 2).map((d) => ({ ...d })));
    expect(new Set(s.topDomains.slice(n - 2, n).map((d) => JSON.stringify(d)))).toEqual(
      new Set(TRUTH_TOP_DOMAINS.slice(n - 2).map((d) => JSON.stringify(d))),
    );
    for (let i = 1; i < s.topDomains.length; i++) expect(s.topDomains[i - 1].count).toBeGreaterThanOrEqual(s.topDomains[i].count);
  });

  it('lists owned citations per platform, non-zero only, count desc', () => {
    const expected = TRUTH_PLATFORMS.filter((p) => p.ownedCitations > 0)
      .map((p) => ({ platform: p.name, count: p.ownedCitations }))
      .sort((a, b) => b.count - a.count);
    expect(s.ownedByPlatform).toEqual(expected);
  });

  it('is empty, not broken, without citations', () => {
    expect(sourceStructure([])).toEqual({
      byType: [],
      topDomains: [],
      ownedShare: { owned: 0, totalCitations: 0, shareOfCitations: 0 },
      ownedByPlatform: [],
    });
  });
});
