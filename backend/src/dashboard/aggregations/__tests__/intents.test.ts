import { describe, expect, it } from 'vitest';
import { TRUTH_INTENTS } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { INTENT_DISPLAY_ORDER, INTENT_LABELS } from '../../schema';
import { intentRows } from '../intents';

const all = loadQuestions();

describe('intentRows', () => {
  const rows = intentRows(all);

  it('always returns the four tiers in display order C, B, A, S', () => {
    expect(rows.map((r) => r.tier)).toEqual([...INTENT_DISPLAY_ORDER]);
    expect(intentRows([]).map((r) => r.tier)).toEqual([...INTENT_DISPLAY_ORDER]);
  });

  it('matches every tier truth', () => {
    for (const t of TRUTH_INTENTS) {
      expect(rows.find((r) => r.tier === t.tier)).toEqual({
        tier: t.tier,
        label: INTENT_LABELS[t.tier].name,
        questions: t.questions,
        mentions: t.mentions,
        recommendations: t.recommendations,
        visibility: t.visibility,
        recommendationRateOfAsked: t.recommendationRateOfAsked,
        isEmpty: t.questions === 0,
      });
    }
  });

  it('marks S as empty (Not tracked), not as a 0% measurement', () => {
    expect(rows.find((r) => r.tier === 'S')!.isEmpty).toBe(true);
    expect(rows.filter((r) => r.isEmpty).map((r) => r.tier)).toEqual(TRUTH_INTENTS.filter((t) => t.questions === 0).map((t) => t.tier));
  });
});
