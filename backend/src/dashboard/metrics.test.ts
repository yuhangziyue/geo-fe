import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '../shared/paths';
import {
  TRUTH_FUNNEL,
  TRUTH_INTENTS,
  TRUTH_MATRIX,
  TRUTH_OWNED_SHARE,
  TRUTH_PERIOD,
  TRUTH_PLATFORMS,
  TRUTH_SOURCE_BACKED,
  TRUTH_TOPICS,
  TRUTH_TREND,
} from './__fixtures__/truth';
import { computeSummary, pct } from './metrics';
import { loadQuestions } from './repo';
import { INTENT_DISPLAY_ORDER, PLATFORMS } from './schema';

const questions = loadQuestions();
const reference = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'project1_dashboard', 'dashboard_summary.json'), 'utf8'));

describe('pct (e2, unchanged)', () => {
  it('rounds half to even and guards a zero denominator', () => {
    const deepseek = TRUTH_PLATFORMS.find((p) => p.name === 'DeepSeek')!;
    expect(pct(deepseek.cited, deepseek.mentions)).toBe(deepseek.sourceBackedRateOfMentioned);
    expect(pct(deepseek.recommendations, deepseek.n)).toBe(deepseek.recommendationRateOfAsked);
    expect(pct(1, 0)).toBe(0);
  });
});

describe('computeSummary v3', () => {
  const s = computeSummary(questions, {});

  it('returns the v3 funnel', () => {
    expect(s.funnel).toEqual({
      questions: { value: TRUTH_FUNNEL.questions },
      mentions: { ...TRUTH_FUNNEL.mentions, deltaPt: TRUTH_PERIOD.deltaPt },
      recommendations: { ...TRUTH_FUNNEL.recommendations, deltaPt: expect.any(Number) },
      sourceBacked: { cited: TRUTH_SOURCE_BACKED.cited, rateOfMentioned: TRUTH_SOURCE_BACKED.rateOfMentioned, deltaPt: expect.any(Number) },
      ownedSource: { ...TRUTH_OWNED_SHARE, deltaPt: expect.any(Number) },
    });
  });

  it('carries brand, period and the echoed filter', () => {
    expect(s.brand).toBe(reference.brand);
    expect(s.period).toBe(`${TRUTH_PERIOD.first.from}~${TRUTH_PERIOD.last.to}`);
    expect(s.filter).toEqual({});
  });

  it('assembles every block', () => {
    expect(s.platforms.map((p) => p.name)).toEqual([...PLATFORMS]);
    expect(s.trend).toHaveLength(TRUTH_TREND.days);
    expect(s.intents.map((i) => i.tier)).toEqual([...INTENT_DISPLAY_ORDER]);
    expect(s.intents.map((i) => i.visibility)).toEqual(TRUTH_INTENTS.map((t) => t.visibility));
    expect(s.matrix.stateCounts).toEqual(TRUTH_MATRIX.stateCounts);
    expect(s.sources.ownedShare).toEqual({ ...TRUTH_OWNED_SHARE });
    expect(s.periodHalves.first.n).toBe(TRUTH_PERIOD.first.n);
    expect(s.periodHalves.last.n).toBe(TRUTH_PERIOD.last.n);
  });

  it('lists topics with the single weakest flagged', () => {
    expect(s.topics.map(({ topic, questions: n, visibility, isWorst }) => ({ topic, n, visibility, isWorst }))).toEqual(
      TRUTH_TOPICS.map((t) => ({ topic: t.topic, n: t.questions, visibility: t.visibility, isWorst: t.isWorst })),
    );
  });

  it('still matches the vendor dashboard_summary.json per platform and topic', () => {
    for (const ref of reference.platforms) {
      expect(s.platforms.find((p) => p.name === ref.name)).toMatchObject({
        visibility: ref.visibility,
        mentions: ref.mentions,
        recommendations: ref.recommendations,
        n: ref.question_count,
      });
    }
    for (const ref of reference.topics) {
      expect(s.topics.find((t) => t.topic === ref.topic)).toMatchObject({
        visibility: ref.visibility,
        recommendations: ref.recommendations,
        questions: ref.questions,
      });
    }
  });

  it('applies the platform filter everywhere except the matrix', () => {
    const deepseek = TRUTH_PLATFORMS.find((p) => p.name === 'DeepSeek')!;
    const d = computeSummary(questions, { platform: 'DeepSeek' });
    expect(d.filter).toEqual({ platform: 'DeepSeek' });
    expect(d.funnel.questions.value).toBe(deepseek.n);
    expect(d.funnel.mentions.rateOfAsked).toBe(deepseek.visibility);
    expect(d.funnel.mentions.deltaPt).not.toBeNull();
    expect(d.platforms.map((p) => p.name)).toEqual(['DeepSeek']);
    expect(d.matrix.stateCounts).toEqual(TRUTH_MATRIX.stateCounts);
    expect(d.matrix.collapsedByDefault).toBe(true);
    expect(d.trend).toHaveLength(TRUTH_TREND.days);
  });

  it('applies the intent filter', () => {
    const a = TRUTH_INTENTS.find((t) => t.tier === 'A')!;
    const d = computeSummary(questions, { intent: 'A' });
    expect(d.funnel.questions.value).toBe(a.questions);
    expect(d.intents.find((i) => i.tier === 'A')!.questions).toBe(a.questions);
    expect(d.intents.find((i) => i.tier === 'B')!.isEmpty).toBe(true);
  });

  it('a filter matching nothing gives an empty summary, not an error', () => {
    const d = computeSummary(questions, { topic: 'No such topic' });
    expect(d.funnel.questions.value).toBe(0);
    expect(d.funnel.mentions.deltaPt).toBeNull();
    expect(d.platforms).toEqual([]);
    expect(d.topics).toEqual([]);
    expect(d.matrix.rows).toEqual([]);
    expect(d.trend).toHaveLength(TRUTH_TREND.days);
    expect(d.trend.every((p) => p.dailyVisibility === null && p.rollingVisibility === null)).toBe(true);
  });
});
