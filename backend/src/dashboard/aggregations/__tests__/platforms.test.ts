import { describe, expect, it } from 'vitest';
import { TRUTH_PLATFORMS } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { PLATFORMS } from '../../schema';
import { platformRows } from '../platforms';

const all = loadQuestions();

describe('platformRows (ratio version)', () => {
  const rows = platformRows(all);

  it('returns one row per platform, in PLATFORMS order', () => {
    expect(rows.map((r) => r.name)).toEqual([...PLATFORMS]);
  });

  it('matches every platform truth: counts, rates and the worst flag', () => {
    for (const t of TRUTH_PLATFORMS) {
      expect(rows.find((r) => r.name === t.name)).toEqual({
        name: t.name,
        n: t.n,
        mentions: t.mentions,
        recommendations: t.recommendations,
        cited: t.cited,
        visibility: t.visibility,
        recommendationRateOfAsked: t.recommendationRateOfAsked,
        sourceBackedRateOfMentioned: t.sourceBackedRateOfMentioned,
        isWorst: t.isWorst,
      });
    }
  });

  it('flags only DeepSeek as worst', () => {
    expect(rows.filter((r) => r.isWorst).map((r) => r.name)).toEqual(TRUTH_PLATFORMS.filter((t) => t.isWorst).map((t) => t.name));
  });

  it('drops platforms without rows and flags no worst for a single platform', () => {
    const deepseek = TRUTH_PLATFORMS.find((t) => t.name === 'DeepSeek')!;
    const only = platformRows(all.filter((q) => q.platform === 'DeepSeek'));
    expect(only).toHaveLength(1);
    expect(only[0]).toMatchObject({ name: 'DeepSeek', n: deepseek.n, isWorst: false });
    expect(platformRows([])).toEqual([]);
  });
});
