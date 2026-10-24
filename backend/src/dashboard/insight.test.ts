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

  it('points the weak topic to the Knowledge Center page to improve', () => {
    expect(byId['weak-topic'].action).toEqual({ label: 'Open the Office scenario page', href: '/scenarios/office' });
  });
});
