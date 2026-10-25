import { describe, expect, it } from 'vitest';
import { TRUTH_FUNNEL, TRUTH_OWNED_SHARE, TRUTH_PLATFORMS } from '../__fixtures__/truth';
import { fullFacts } from './__fixtures__/facts';
import { buildTemplateSummary, FALLBACK_NOTE } from './template';

const facts = fullFacts();
const WEAK_PLATFORM = TRUTH_PLATFORMS.find((p) => p.isWorst)!;

describe('buildTemplateSummary', () => {
  const r = buildTemplateSummary(facts);

  it('is a rules-mode result, 100% verified', () => {
    expect(r.mode).toBe('rules');
    expect(r.model).toBeNull();
    expect(r.reason).toBeNull();
    expect(r.numbers.length).toBeGreaterThan(0);
    expect(r.numbers.every((n) => n.verified)).toBe(true);
    expect(r.verification).toEqual({ verified: r.numbers.length, total: r.numbers.length, band: 'all' });
  });

  it('is built from the facts: funnel, weakest platform, owned share', () => {
    const raws = r.numbers.map((n) => n.raw);
    for (const token of [
      String(TRUTH_FUNNEL.questions),
      String(TRUTH_FUNNEL.mentions.value),
      `${TRUTH_FUNNEL.mentions.rateOfAsked}%`,
      String(TRUTH_FUNNEL.recommendations.value),
      `${TRUTH_FUNNEL.recommendations.rateOfAsked}%`,
      `${TRUTH_OWNED_SHARE.shareOfCitations}%`,
      String(TRUTH_OWNED_SHARE.totalCitations),
    ])
      expect(raws).toContain(token);
    expect(r.text).toContain(WEAK_PLATFORM.name);
    expect(r.text).toContain(`${WEAK_PLATFORM.visibility}%`);
    expect(r.text).toContain(facts.brand);
  });

  it('every number offset points into the text', () => {
    for (const n of r.numbers) expect(r.text.slice(n.start, n.end)).toBe(n.raw);
  });

  it('is deterministic', () => {
    expect(buildTemplateSummary(facts)).toEqual(r);
  });

  it('on an AI fallback, keeps the reason and opens with the unavailable note', () => {
    for (const reason of ['timeout', 'upstream_error'] as const) {
      const fb = buildTemplateSummary(facts, reason);
      expect(fb.reason).toBe(reason);
      expect(fb.mode).toBe('rules');
      expect(fb.text.split('\n')[0]).toBe(FALLBACK_NOTE);
      expect(FALLBACK_NOTE).toBe('(AI summary unavailable — showing rule-based findings.)');
      expect(fb.verification.band).toBe('all');
    }
  });

  it('no key is not a failure: reason is kept, no unavailable note', () => {
    const nk = buildTemplateSummary(facts, 'no_api_key');
    expect(nk.reason).toBe('no_api_key');
    expect(nk.text).not.toContain(FALLBACK_NOTE);
  });

  it('says "too few samples" instead of a delta when a half is thin, and still verifies 100%', () => {
    const thin = { ...facts, delta: { mentionRateOfAskedPt: null, firstN: 3, lastN: 4 }, topFindings: [] };
    const t = buildTemplateSummary(thin);
    expect(t.text).toMatch(/too few samples/i);
    expect(t.verification.band).toBe('all');
  });

  it('never throws, even on an empty selection', () => {
    const empty = {
      ...facts,
      funnel: { questions: 0, mentions: 0, mentionRateOfAsked: 0, recommendations: 0, recommendRateOfAsked: 0, recommendRateOfMentioned: 0 },
      delta: { mentionRateOfAskedPt: null, firstN: 0, lastN: 0 },
      sources: { ownedShareOfCitations: 0, totalCitations: 0 },
      topFindings: [],
    };
    const t = buildTemplateSummary(empty);
    expect(t.mode).toBe('rules');
    expect(t.verification.band).toBe('all');
  });
});
