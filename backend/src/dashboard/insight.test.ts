import { describe, expect, it } from 'vitest';
import { buildInsights } from './insight';
import { loadQuestions } from './repo';

const questions = loadQuestions();

describe('buildInsights', () => {
  const insights = buildInsights(questions, {});
  const byId = Object.fromEntries(insights.map((i) => [i.id, i]));
  const text = (id: string) => `${byId[id].title} ${byId[id].detail}`;

  it('returns the rule-based insights in order', () => {
    expect(insights.map((i) => i.id)).toEqual([
      'weak-platform',
      'weak-topic',
      'weak-intent',
      'mention-not-recommended',
      'mentioned-not-cited',
      'owned-sources',
    ]);
  });

  it('cites the numbers behind each insight', () => {
    for (const s of ['DeepSeek', '46', '71']) expect(text('weak-platform')).toContain(s);
    for (const s of ['Office Security', '53', 'Office scenario page']) expect(text('weak-topic')).toContain(s);
    for (const s of ['Intent A', '65', '39/60']) expect(text('weak-intent')).toContain(s);
    expect(text('mention-not-recommended')).toContain('29');
    for (const s of ['Gemini', '87', '10']) expect(text('mentioned-not-cited')).toContain(s);
    for (const s of ['7', '71']) expect(text('owned-sources')).toContain(s);
  });

  it('links every insight to filtered evidence', () => {
    for (const i of insights) expect(i.evidenceHref.startsWith('/dashboard/questions?')).toBe(true);
    expect(byId['weak-intent'].evidenceHref).toContain('intent=A');
  });

  it('does not compare platforms when only one is selected, and ignores tiny groups', () => {
    const one = buildInsights(questions, { platform: 'DeepSeek' });
    const ids = one.map((i) => i.id);
    // With one platform there is nothing to rank: "weakest" and "highest" would both name DeepSeek.
    expect(ids).not.toContain('weak-platform');
    expect(ids).not.toContain('mentioned-not-cited');
    // Product Comparison has 1 DeepSeek question: too small to call "the weakest topic".
    const weakTopic = one.find((i) => i.id === 'weak-topic');
    expect(weakTopic?.title).not.toContain('Product Comparison');
    expect(weakTopic?.detail).toMatch(/out of ([3-9]|\d{2,}) questions/);
  });

  it('points the weak topic to the Knowledge Center page to improve', () => {
    expect(byId['weak-topic'].action).toEqual({ label: 'Open the Office scenario page', href: '/scenarios/office' });
  });
});
