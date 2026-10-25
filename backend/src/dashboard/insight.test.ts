import { describe, expect, it } from 'vitest';
import { buildActions, factsForLlm } from './insight';
import { loadQuestions, productSlugs } from './repo';
import {
  OWNED_DOMAIN,
  OWNED_DOMAIN_DISCLAIMER,
  compareActionCards,
  type ActionCard,
  type Question,
  type RuleId,
  type TopicScenarioMap,
} from './schema';
import {
  TRUTH_ACTION_CARDS,
  TRUTH_F3_F6,
  TRUTH_FUNNEL,
  TRUTH_OWNED_SHARE,
  TRUTH_PERIOD,
  TRUTH_PLATFORMS,
  TRUTH_TOPICS,
} from './__fixtures__/truth';
import { truthSummary, TEST_BRAND } from './llm/__fixtures__/facts';

const questions = loadQuestions();
const OFFICE: TopicScenarioMap = new Map([['Office Security', { slug: 'office', name: 'Office' }]]);
const WEAK_TOPIC = TRUTH_TOPICS.find((t) => t.isWorst)!;
const WEAK_PLATFORM = TRUTH_PLATFORMS.find((p) => p.isWorst)!;

const byId = (cards: ActionCard[]) => new Map(cards.map((c) => [c.id, c]));
const card = (cards: ActionCard[], id: RuleId) => {
  const c = byId(cards).get(id);
  if (!c) throw new Error(`card ${id} missing`);
  return c;
};
const evidenceValues = (c: ActionCard) => c.evidence.map((e) => e.value);
const qs = (o: Record<string, string>) => `/dashboard/questions?${new URLSearchParams(o).toString()}`;

/** A synthetic run; only the fields the rules read matter. */
function run(over: Partial<Question>): Question {
  return {
    id: 1,
    date: '2026-08-01',
    platform: 'ChatGPT',
    topic: 'T',
    intent_type: 'A',
    question: 'q',
    brand_mentioned: true,
    brand_recommended: true,
    sentiment: 'positive',
    mentioned_products: [],
    answer_excerpt: '',
    citations: [],
    citation_count: 0,
    prompt_id: 'p',
    ...over,
  };
}
const cite = (host: string) => ({ title: 't', url: `https://${host}/x`, source_type: 'Media' });

describe('buildActions — full data', () => {
  const cards = buildActions(questions, {}, OFFICE);

  it('fires all 7 rules in the I5 order with the truth affectedQuestions', () => {
    expect(cards.map(({ id, severity, affectedQuestions }) => ({ id, severity, affectedQuestions }))).toEqual(
      TRUTH_ACTION_CARDS.map((c) => ({ ...c })),
    );
    expect([...cards].sort(compareActionCards)).toEqual(cards);
  });

  it('every card has structured evidence (≤ 3, 06 §5.8) and a filtered evidence link', () => {
    for (const c of cards) {
      expect(c.evidence.length).toBeGreaterThan(0);
      expect(c.evidence.length).toBeLessThanOrEqual(3);
      for (const e of c.evidence) {
        expect(typeof e.value).toBe('number');
        expect(['pct', 'pt', 'count']).toContain(e.unit);
      }
      expect(c.evidenceHref.startsWith('/dashboard/questions?')).toBe(true);
    }
  });

  it('never bakes a number into finding or action text (05 §3: numbers live in evidence)', () => {
    for (const c of cards) {
      expect(c.finding).not.toMatch(/\d/);
      expect(c.action).not.toMatch(/\d/);
      // labels reach the LLM facts and the template text; a digit there would be read back as an unverifiable number
      for (const e of c.evidence) expect(e.label).not.toMatch(/\d/);
    }
  });

  it('carries the truth numbers as evidence', () => {
    expect(card(cards, 'no-source-no-mention').evidence[0]).toMatchObject({
      value: TRUTH_F3_F6.notMentionedWithoutCitations,
      unit: 'count',
      of: TRUTH_F3_F6.notMentioned,
    });
    expect(evidenceValues(card(cards, 'visibility-declining'))).toEqual([TRUTH_PERIOD.first.pct, TRUTH_PERIOD.last.pct, TRUTH_PERIOD.deltaPt]);
    expect(card(cards, 'visibility-declining').evidence.map((e) => e.unit)).toEqual(['pct', 'pct', 'pt']);
    expect(card(cards, 'weak-platform').finding).toContain(WEAK_PLATFORM.name);
    expect(evidenceValues(card(cards, 'weak-platform')).slice(0, 2)).toEqual([WEAK_PLATFORM.visibility, TRUTH_FUNNEL.mentions.rateOfAsked]);
    expect(card(cards, 'mention-not-recommended').evidence[0]).toMatchObject({
      value: TRUTH_F3_F6.mentionedNotRecommended,
      unit: 'count',
      of: TRUTH_FUNNEL.mentions.value,
    });
    expect(card(cards, 'weak-topic').finding).toContain(WEAK_TOPIC.topic);
    expect(evidenceValues(card(cards, 'weak-topic')).slice(0, 2)).toEqual([WEAK_TOPIC.visibility, TRUTH_FUNNEL.mentions.rateOfAsked]);
    expect(card(cards, 'owned-source-share').evidence).toEqual([
      expect.objectContaining({ value: TRUTH_OWNED_SHARE.owned, unit: 'count', of: TRUTH_OWNED_SHARE.totalCitations }),
      expect.objectContaining({ value: TRUTH_OWNED_SHARE.shareOfCitations, unit: 'pct' }),
    ]);
  });

  it('drill-down links point at the evidence', () => {
    expect(card(cards, 'no-source-no-mention').evidenceHref).toBe(qs({ mentioned: 'false' }));
    expect(card(cards, 'weak-platform').evidenceHref).toBe(qs({ platform: WEAK_PLATFORM.name, mentioned: 'false' }));
    expect(card(cards, 'weak-topic').evidenceHref).toBe(qs({ topic: WEAK_TOPIC.topic, mentioned: 'false' }));
    expect(card(cards, 'mention-not-recommended').evidenceHref).toBe(qs({ mentioned: 'true', recommended: 'false' }));
    expect(card(cards, 'owned-source-share').evidenceHref).toBe(qs({ q: OWNED_DOMAIN }));
    expect(card(cards, 'decision-tier-untracked').evidenceHref).toBe(qs({ intent: 'S' }));
  });

  it('F9: exactly the two owned-source cards carry OWNED_DOMAIN_DISCLAIMER', () => {
    const withDisclaimer = cards.filter((c) => c.disclaimer !== undefined);
    expect(withDisclaimer.map((c) => c.id).sort()).toEqual(['no-source-no-mention', 'owned-source-share']);
    for (const c of withDisclaimer) expect(c.disclaimer).toBe(OWNED_DOMAIN_DISCLAIMER);
  });
});

describe('buildActions — targets (05 §6 A′: product first)', () => {
  it('mention-not-recommended targets the product named most in mentioned-not-recommended answers', () => {
    const counts = new Map<string, number>();
    for (const q of questions.filter((r) => r.brand_mentioned && !r.brand_recommended))
      for (const p of q.mentioned_products) counts.set(p, (counts.get(p) ?? 0) + 1);
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const t = card(buildActions(questions, {}, OFFICE), 'mention-not-recommended').target;
    expect(t?.kind).toBe('product');
    expect(t?.href).toBe(`/admin/products/${productSlugs().get(top[0])}/edit`);
    expect(t?.label).toContain(top[0]);
  });

  it('with the mapping: weak-topic (and no-source-no-mention, which has no product data) open the scenario', () => {
    const cards = buildActions(questions, {}, OFFICE);
    const expected = { kind: 'scenario', label: 'Open Office scenario', href: '/scenarios/office' };
    expect(card(cards, 'weak-topic').target).toEqual(expected);
    expect(card(cards, 'no-source-no-mention').target).toEqual(expected);
  });

  it('mapping file deleted (empty Map) or mapped to null: every scenario target falls back to /products', () => {
    const generic = { kind: 'generic', label: 'View products', href: '/products' };
    for (const map of [new Map(), new Map([['Office Security', null]])] as TopicScenarioMap[]) {
      const cards = buildActions(questions, {}, map);
      expect(card(cards, 'weak-topic').target).toEqual(generic);
      expect(card(cards, 'no-source-no-mention').target).toEqual(generic);
    }
  });

  it('empty Map (topic-scenario.json deleted): the same 7 cards still come out, no target is a scenario', () => {
    const cards = buildActions(questions, {}, new Map());
    expect(cards.map((c) => c.id)).toEqual(TRUTH_ACTION_CARDS.map((c) => c.id));
    expect(cards.map((c) => c.affectedQuestions)).toEqual(TRUTH_ACTION_CARDS.map((c) => c.affectedQuestions));
    for (const c of cards) if (c.target) expect(['product', 'generic']).toContain(c.target.kind);
    expect(card(cards, 'mention-not-recommended').target?.kind).toBe('product');
  });

  it('owned-source-share → /products; platform, decline and decision-tier have no P2 target', () => {
    const cards = buildActions(questions, {}, OFFICE);
    expect(card(cards, 'owned-source-share').target).toEqual({ kind: 'generic', label: 'View products', href: '/products' });
    for (const id of ['weak-platform', 'visibility-declining', 'decision-tier-untracked'] as const) expect(card(cards, id).target).toBeNull();
  });
});

describe('buildActions — thresholds (no card unless the rule fires)', () => {
  it('decision-tier-untracked does not fire once S questions are monitored', () => {
    const withS = questions.map((q, i) => (i < 2 ? { ...q, intent_type: 'S' } : q));
    expect(byId(buildActions(withS, {}, OFFICE)).has('decision-tier-untracked')).toBe(false);
  });

  it('owned-source-share does not fire at 30 of 100 citations (≥ 25%), fires at 5 of 100', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      run({ id: i + 1, citations: Array.from({ length: 5 }, () => cite(i < 6 ? OWNED_DOMAIN : 'other.example')), citation_count: 5 }),
    );
    expect(byId(buildActions(rows, {}, OFFICE)).has('owned-source-share')).toBe(false);
    const low = rows.map((q, i) => (i === 0 ? q : { ...q, citations: q.citations.map(() => cite('other.example')) }));
    expect(byId(buildActions(low, {}, OFFICE)).has('owned-source-share')).toBe(true);
  });

  it('owned-source-share needs ≥ 10 citations', () => {
    const rows = [run({ citations: Array.from({ length: 9 }, () => cite('other.example')), citation_count: 9 })];
    expect(byId(buildActions(rows, {}, OFFICE)).has('owned-source-share')).toBe(false);
  });

  it('mention-not-recommended needs ≥ 5 such answers; no-source-no-mention needs ≥ 5 unmentioned', () => {
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => run({ id: i + 1, brand_recommended: false })),
      ...Array.from({ length: 4 }, (_, i) => run({ id: i + 10, brand_mentioned: false, brand_recommended: false })),
      ...Array.from({ length: 12 }, (_, i) => run({ id: i + 20 })),
    ];
    const ids = byId(buildActions(rows, {}, OFFICE));
    expect(ids.has('mention-not-recommended')).toBe(false);
    expect(ids.has('no-source-no-mention')).toBe(false);
  });

  it('no-source-no-mention needs ≥ 80% of the unmentioned answers to have no citation', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      run({ id: i + 1, brand_mentioned: false, brand_recommended: false, citations: i < 3 ? [cite('other.example')] : [], citation_count: i < 3 ? 1 : 0 }),
    );
    expect(byId(buildActions(rows, {}, OFFICE)).has('no-source-no-mention')).toBe(false);
    const ok = rows.map((q, i) => (i === 0 ? q : { ...q, citations: [], citation_count: 0 }));
    expect(byId(buildActions(ok, {}, OFFICE)).has('no-source-no-mention')).toBe(true);
  });

  it('a platform or topic filter leaves one platform / topic, so weak-platform / weak-topic cannot fire', () => {
    expect(byId(buildActions(questions, { platform: WEAK_PLATFORM.name }, OFFICE)).has('weak-platform')).toBe(false);
    expect(byId(buildActions(questions, { topic: WEAK_TOPIC.topic }, OFFICE)).has('weak-topic')).toBe(false);
  });

  it('an intent filter does not claim the decision tier is untracked, and every link keeps the filter', () => {
    const cards = buildActions(questions, { intent: 'A' }, OFFICE);
    expect(cards.length).toBeGreaterThan(0);
    expect(byId(cards).has('decision-tier-untracked')).toBe(false);
    for (const c of cards) expect(c.evidenceHref).toContain('intent=A');
  });

  it('an empty selection has no cards', () => {
    expect(buildActions(questions, { topic: 'No such topic' }, OFFICE)).toEqual([]);
    expect(buildActions([], {}, new Map())).toEqual([]);
  });
});

describe('factsForLlm', () => {
  const cards = buildActions(questions, {}, OFFICE);
  const facts = factsForLlm(cards, truthSummary);

  it('copies the summary aggregates with named denominators', () => {
    expect(facts.brand).toBe(TEST_BRAND);
    expect(facts.period).toEqual({ from: TRUTH_PERIOD.first.from, to: TRUTH_PERIOD.last.to });
    expect(facts.funnel).toEqual({
      questions: TRUTH_FUNNEL.questions,
      mentions: TRUTH_FUNNEL.mentions.value,
      mentionRateOfAsked: TRUTH_FUNNEL.mentions.rateOfAsked,
      recommendations: TRUTH_FUNNEL.recommendations.value,
      recommendRateOfAsked: TRUTH_FUNNEL.recommendations.rateOfAsked,
      recommendRateOfMentioned: TRUTH_FUNNEL.recommendations.rateOfPrevious,
    });
    expect(facts.delta).toEqual({ mentionRateOfAskedPt: TRUTH_PERIOD.deltaPt, firstN: TRUTH_PERIOD.first.n, lastN: TRUTH_PERIOD.last.n });
    expect(facts.sources).toEqual({ ownedShareOfCitations: TRUTH_OWNED_SHARE.shareOfCitations, totalCitations: TRUTH_OWNED_SHARE.totalCitations });
  });

  it('takes the first 5 findings in card order, even from unsorted cards', () => {
    const expected = TRUTH_ACTION_CARDS.slice(0, 5).map((c) => card(cards, c.id).finding);
    expect(facts.topFindings.map((f) => f.finding)).toEqual(expected);
    expect(factsForLlm([...cards].reverse(), truthSummary).topFindings.map((f) => f.finding)).toEqual(expected);
    expect(facts.topFindings[0]).toEqual({ severity: cards[0].severity, finding: cards[0].finding, evidence: cards[0].evidence });
  });

  it('carries no raw rows', () => {
    expect(JSON.stringify(facts)).not.toContain('answer_excerpt');
    expect(Object.keys(facts).sort()).toEqual(['brand', 'delta', 'funnel', 'period', 'sources', 'topFindings']);
  });
});
