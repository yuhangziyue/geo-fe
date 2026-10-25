import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROOT_DIR } from '../shared/paths';
import {
  TRUTH_ACTION_CARDS,
  TRUTH_F3_F6,
  TRUTH_FUNNEL,
  TRUTH_INTENTS,
  TRUTH_OWNED_SHARE,
  TRUTH_PERIOD,
  TRUTH_PLATFORMS,
} from './__fixtures__/truth';
import * as http from './http';
import { diagnose, getActionCards, getQuestion, getSummary, listQuestions, postActionSummary } from './http';
import { buildActions, factsForLlm } from './insight';
import { dispatchSummary } from './llm/dispatcher';
import { computeSummary } from './metrics';
import { __resetScenarioCache, loadQuestions, loadTopicScenarios, productSlugs } from './repo';
import {
  OWNED_DOMAIN,
  PLATFORMS,
  verificationOf,
  type ActionCard,
  type LlmFacts,
  type LlmSummaryResult,
  type Question,
} from './schema';

// B2 owns insight.ts and llm/: until it lands those are stubs that throw, so they are mocked here.
// isOwnedUrl (e2) stays real.
vi.mock('./insight', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./insight')>()),
  buildActions: vi.fn(),
  factsForLlm: vi.fn(),
}));
vi.mock('./llm/dispatcher', () => ({ dispatchSummary: vi.fn() }));

const all = loadQuestions();
const get = (p: string) => new Request(`http://localhost${p}`);
const post = (p: string, body: string) => new Request(`http://localhost${p}`, { method: 'POST', body });
const idCtx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

const CARDS: ActionCard[] = TRUTH_ACTION_CARDS.map((c) => ({
  ...c,
  finding: c.id,
  evidence: [],
  action: c.id,
  evidenceHref: '/dashboard/questions',
  target: null,
}));
const FACTS: LlmFacts = {
  brand: 'AsterVision',
  period: { from: TRUTH_PERIOD.first.from, to: TRUTH_PERIOD.last.to },
  funnel: {
    questions: TRUTH_FUNNEL.questions,
    mentions: TRUTH_FUNNEL.mentions.value,
    mentionRateOfAsked: TRUTH_FUNNEL.mentions.rateOfAsked,
    recommendations: TRUTH_FUNNEL.recommendations.value,
    recommendRateOfAsked: TRUTH_FUNNEL.recommendations.rateOfAsked,
    recommendRateOfMentioned: TRUTH_FUNNEL.recommendations.rateOfPrevious,
  },
  delta: { mentionRateOfAskedPt: TRUTH_PERIOD.deltaPt, firstN: TRUTH_PERIOD.first.n, lastN: TRUTH_PERIOD.last.n },
  sources: { ownedShareOfCitations: TRUTH_OWNED_SHARE.shareOfCitations, totalCitations: TRUTH_OWNED_SHARE.totalCitations },
  topFindings: [],
};
const RESULT = (over: Partial<LlmSummaryResult> = {}): LlmSummaryResult => ({
  mode: 'rules',
  text: 'summary',
  numbers: [],
  verification: verificationOf(0, 0),
  model: null,
  reason: null,
  ...over,
});

beforeEach(() => {
  vi.mocked(buildActions).mockReset().mockReturnValue(CARDS);
  vi.mocked(factsForLlm).mockReset().mockReturnValue(FACTS);
  vi.mocked(dispatchSummary).mockReset().mockResolvedValue(RESULT());
});
afterEach(() => __resetScenarioCache());

describe('parameter validation (400 problem+json)', () => {
  it('rejects an unknown platform', async () => {
    for (const res of [
      await listQuestions(get('/api/dashboard/questions?platform=Foo')),
      await getSummary(get('/api/dashboard/summary?platform=Foo')),
      await getActionCards(get('/api/dashboard/action-center/cards?platform=Foo')),
    ]) {
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toContain('application/problem+json');
      expect((await res.json()).status).toBe(400);
    }
  });

  it('rejects an intent outside S/A/B/C', async () => {
    expect((await listQuestions(get('/api/dashboard/questions?intent=X'))).status).toBe(400);
    expect((await getSummary(get('/api/dashboard/summary?intent=X'))).status).toBe(400);
    expect((await getActionCards(get('/api/dashboard/action-center/cards?intent=X'))).status).toBe(400);
  });

  it('rejects page=-1 and mentioned=maybe', async () => {
    expect((await listQuestions(get('/api/dashboard/questions?page=-1'))).status).toBe(400);
    expect((await listQuestions(get('/api/dashboard/questions?mentioned=maybe'))).status).toBe(400);
  });

  it('rejects a bad summary body', async () => {
    expect((await postActionSummary(post('/api/dashboard/action-center/summary', '{nope'))).status).toBe(400);
    expect((await postActionSummary(post('/api/dashboard/action-center/summary', '{"mode":"poem"}'))).status).toBe(400);
    expect((await postActionSummary(post('/api/dashboard/action-center/summary', '{}'))).status).toBe(400);
    expect(dispatchSummary).not.toHaveBeenCalled();
  });

  it('404 for a missing question, 400 for a non-numeric id', async () => {
    expect((await getQuestion(get('/api/dashboard/questions/9999'), idCtx(9999))).status).toBe(404);
    expect((await getQuestion(get('/api/dashboard/questions/abc'), idCtx('abc'))).status).toBe(400);
  });
});

describe('simulate', () => {
  const endpoints = () => [
    getSummary(get('/api/dashboard/summary?simulate=error')),
    listQuestions(get('/api/dashboard/questions?simulate=error')),
    getQuestion(get('/api/dashboard/questions/1?simulate=error'), idCtx(1)),
    getActionCards(get('/api/dashboard/action-center/cards?simulate=error')),
    postActionSummary(post('/api/dashboard/action-center/summary?simulate=error', '{"mode":"rules"}')),
  ];

  it('error → 500 on all five endpoints', async () => {
    for (const res of await Promise.all(endpoints())) expect(res.status).toBe(500);
  });

  it('empty → an empty shell of every DTO; facets still come from the full data', async () => {
    const s = await (await getSummary(get('/api/dashboard/summary?simulate=empty'))).json();
    expect(s.funnel.questions.value).toBe(0);
    expect(s.funnel.mentions).toEqual({ value: 0, rateOfAsked: 0, rateOfPrevious: 0, deltaPt: null });
    expect(s.platforms).toEqual([]);
    expect(s.trend).toEqual([]);
    expect(s.topics).toEqual([]);
    expect(s.matrix.rows).toEqual([]);
    expect(s.matrix.platforms).toEqual([...PLATFORMS]);
    expect(s.facets.platforms).toEqual([...PLATFORMS]);
    expect(s.facets.topics.length).toBeGreaterThan(0);

    const list = await (await listQuestions(get('/api/dashboard/questions?simulate=empty'))).json();
    expect(list).toMatchObject({ items: [], total: 0 });
    expect(list.facets.platforms).toEqual([...PLATFORMS]);

    const detail = await (await getQuestion(get('/api/dashboard/questions/1?simulate=empty'), idCtx(1))).json();
    expect(detail).toMatchObject({ question: null, diagnosis: null, crossPlatform: [] });

    const cards = await (await getActionCards(get('/api/dashboard/action-center/cards?simulate=empty'))).json();
    expect(cards.cards).toEqual([]);
    expect(cards.facts.funnel.questions).toBe(0);

    const sum = await (await postActionSummary(post('/api/dashboard/action-center/summary?simulate=empty', '{"mode":"ai"}'))).json();
    expect(sum).toMatchObject({ mode: 'rules', text: '', numbers: [], model: null });
    expect(buildActions).not.toHaveBeenCalled();
    expect(dispatchSummary).not.toHaveBeenCalled();
  });
});

describe('GET /summary', () => {
  it('serves SummaryV3 + facets from the full data, even when filtered', async () => {
    const body = await (await getSummary(get('/api/dashboard/summary?platform=DeepSeek&intent=A'))).json();
    expect(body).toEqual(JSON.parse(JSON.stringify({ ...computeSummary(all, { platform: 'DeepSeek', intent: 'A' }), facets: body.facets })));
    expect(body.filter).toEqual({ platform: 'DeepSeek', intent: 'A' });
    expect(body.facets.platforms).toEqual([...PLATFORMS]);
    expect(body.facets.intents).toEqual(TRUTH_INTENTS.filter((t) => t.questions > 0).map((t) => t.tier).sort());
  });

  it('a filter matching nothing is 200, not 500', async () => {
    const res = await getSummary(get('/api/dashboard/summary?topic=Nothing'));
    expect(res.status).toBe(200);
    expect((await res.json()).funnel.questions.value).toBe(0);
  });
});

describe('KPI Asked = questions total under the same filter (05 §2.1)', () => {
  it.each(['', 'platform=DeepSeek&intent=A', 'topic=Office%20Security'])('filter "%s"', async (qs) => {
    const summary = await (await getSummary(get(`/api/dashboard/summary?${qs}`))).json();
    const list = await (await listQuestions(get(`/api/dashboard/questions?${qs}`))).json();
    expect(summary.funnel.questions.value).toBe(list.total);
    expect(list.total).toBeGreaterThan(0);
  });
});

describe('GET /questions', () => {
  it('filters by platform + mentioned and by intent', async () => {
    const deepseek = TRUTH_PLATFORMS.find((p) => p.name === 'DeepSeek')!;
    const body = await (await listQuestions(get('/api/dashboard/questions?platform=DeepSeek&mentioned=false'))).json();
    expect(body.total).toBe(deepseek.n - deepseek.mentions);
    const a = TRUTH_INTENTS.find((t) => t.tier === 'A')!;
    expect((await (await listQuestions(get('/api/dashboard/questions?intent=A'))).json()).total).toBe(a.questions);
    expect((await (await listQuestions(get('/api/dashboard/questions?intent=S'))).json()).total).toBe(0);
  });
});

describe('GET /questions/[id] — v3 detail', () => {
  it('returns the question, its diagnosis and every run of the same question (this one included)', async () => {
    const body = await (await getQuestion(get('/api/dashboard/questions/1'), idCtx(1))).json();
    const q = all.find((x) => x.id === 1)!;
    expect(body.question.id).toBe(1);
    expect(body.diagnosis.code).toBeTypeOf('string');
    const same = all.filter((x) => x.prompt_id === q.prompt_id);
    expect(body.crossPlatform.map((r: { id: number }) => r.id).sort()).toEqual(same.map((x) => x.id).sort());
    expect(body.crossPlatform[0]).toHaveProperty('answer_excerpt');
    const dates = body.crossPlatform.map((r: { date: string }) => r.date);
    expect([...dates].sort()).toEqual(dates);
    expect(body).not.toHaveProperty('otherRuns');
    expect(body.analysis.products).toEqual(q.mentioned_products.map((name) => ({ name, slug: productSlugs().get(name) ?? null })));
  });
});

describe('diagnose (05 §2.8) — first matching rule wins', () => {
  const base = all[0];
  const q = (over: Partial<Question>): Question => ({ ...base, sentiment: 'positive', ...over });
  const scenarios = new Map([[base.topic, { slug: 'office', name: 'Office' }]]);
  const slugs = new Map([['Nova PTZ 30', 'nova-ptz-30']]);
  const owned = { title: 'o', url: `https://${OWNED_DOMAIN}/p`, source_type: 'Official' };
  const third = { title: 't', url: 'https://securitytoday.example/a', source_type: 'Media' };

  it('content gap: not mentioned → scenario page, else /products', () => {
    const nm = q({ brand_mentioned: false, brand_recommended: false, mentioned_products: [], citations: [], citation_count: 0 });
    expect(diagnose(nm, scenarios, slugs)).toMatchObject({ code: 'content_gap', target: { kind: 'scenario', href: '/scenarios/office' } });
    expect(diagnose(nm, new Map(), slugs).target).toEqual({ kind: 'generic', label: 'View products', href: '/products' });
  });

  it('persuasion gap: mentioned, not recommended → product edit page, else scenario, else /products', () => {
    const p = q({ brand_mentioned: true, brand_recommended: false, mentioned_products: ['Nova PTZ 30'] });
    expect(diagnose(p, scenarios, slugs)).toMatchObject({
      code: 'persuasion_gap',
      target: { kind: 'product', href: '/admin/products/nova-ptz-30/edit' },
    });
    const noProduct = { ...p, mentioned_products: [] };
    expect(diagnose(noProduct, scenarios, slugs).target).toMatchObject({ kind: 'scenario' });
    expect(diagnose(noProduct, new Map(), slugs).target).toMatchObject({ kind: 'generic', href: '/products' });
  });

  it('source gap: recommended without an owned citation → product page', () => {
    const s = q({ brand_mentioned: true, brand_recommended: true, mentioned_products: ['Nova PTZ 30'], citations: [third], citation_count: 1 });
    expect(diagnose(s, scenarios, slugs)).toMatchObject({ code: 'source_gap', target: { kind: 'product', href: '/products/nova-ptz-30' } });
    expect(diagnose({ ...s, mentioned_products: [] }, scenarios, slugs).target).toMatchObject({ kind: 'generic', href: '/products' });
  });

  it('healthy: recommended with an owned citation → no target', () => {
    const h = q({ brand_mentioned: true, brand_recommended: true, citations: [owned], citation_count: 1 });
    expect(diagnose(h, scenarios, slugs)).toMatchObject({ code: 'healthy', target: null });
  });

  it('adds "Answer tone is mixed" for mixed sentiment', () => {
    expect(diagnose(q({ sentiment: 'mixed' }), scenarios, slugs).extra).toEqual(['Answer tone is mixed']);
    expect(diagnose(q({}), scenarios, slugs).extra).toBeUndefined();
  });

  it('matches the F3/F6 distribution over the data: content 35 / persuasion 29 / source 51 / healthy 5', () => {
    const counts: Record<string, number> = {};
    for (const x of all) {
      const code = diagnose(x, loadTopicScenarios(), productSlugs()).code;
      counts[code] = (counts[code] ?? 0) + 1;
    }
    expect(counts).toEqual({
      content_gap: TRUTH_F3_F6.notMentioned,
      persuasion_gap: TRUTH_F3_F6.mentionedNotRecommended,
      source_gap: TRUTH_F3_F6.recommendedWithoutOwned,
      healthy: TRUTH_FUNNEL.recommendations.value - TRUTH_F3_F6.recommendedWithoutOwned,
    });
  });
});

describe('action center', () => {
  it('GET /cards → { cards, facts } from the rule engine, never the LLM', async () => {
    const res = await getActionCards(get('/api/dashboard/action-center/cards?platform=DeepSeek'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify({ cards: CARDS, facts: FACTS })));
    expect(buildActions).toHaveBeenCalledWith(all, { platform: 'DeepSeek' }, loadTopicScenarios());
    const summary = computeSummary(all, { platform: 'DeepSeek' });
    expect(factsForLlm).toHaveBeenCalledWith(CARDS, expect.objectContaining({
      brand: summary.brand,
      funnel: summary.funnel,
      periodHalves: summary.periodHalves,
      sources: summary.sources,
    }));
    expect(dispatchSummary).not.toHaveBeenCalled();
  });

  it('POST /summary {mode:"rules"} → dispatchSummary("rules", facts)', async () => {
    const res = await postActionSummary(post('/api/dashboard/action-center/summary', '{"mode":"rules","intent":"A"}'));
    expect(res.status).toBe(200);
    expect((await res.json()).mode).toBe('rules');
    expect(dispatchSummary).toHaveBeenCalledWith('rules', FACTS);
    expect(buildActions).toHaveBeenCalledWith(all, { intent: 'A' }, loadTopicScenarios());
  });

  it('POST /summary {mode:"ai"} passes the dispatcher result through, including a degraded one', async () => {
    vi.mocked(dispatchSummary).mockResolvedValue(RESULT({ mode: 'rules', reason: 'upstream_error' }));
    const res = await postActionSummary(post('/api/dashboard/action-center/summary', '{"mode":"ai"}'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: 'rules', reason: 'upstream_error' });
    expect(dispatchSummary).toHaveBeenCalledWith('ai', FACTS);
  });

  it('the v2 insight endpoint is gone (route file deleted → 404, handler removed)', () => {
    expect(fs.existsSync(path.join(ROOT_DIR, 'frontend', 'app', 'api', 'dashboard', 'insight', 'route.ts'))).toBe(false);
    expect('postInsight' in http).toBe(false);
  });
});

describe('regression: topic-scenario.json deleted (05 §1, Review Focus #12)', () => {
  const tmpMapping = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-scenario-'));
    const file = path.join(dir, 'topic-scenario.json');
    const topics = [...new Set(all.map((q) => q.topic))];
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(topics.map((t) => [t, 'office']))));
    return file;
  };
  const snapshot = async () => {
    const contentGap = all.find((q) => !q.brand_mentioned)!;
    return {
      summary: await (await getSummary(get('/api/dashboard/summary?intent=A'))).json(),
      list: await (await listQuestions(get('/api/dashboard/questions?mentioned=false'))).json(),
      detail: await (await getQuestion(get(`/api/dashboard/questions/${contentGap.id}`), idCtx(contentGap.id))).json(),
      cards: await (await getActionCards(get('/api/dashboard/action-center/cards'))).json(),
      summaryPost: (await postActionSummary(post('/api/dashboard/action-center/summary', '{"mode":"rules"}'))).status,
      mapArg: vi.mocked(buildActions).mock.lastCall?.[2],
    };
  };

  it('only the scenario links disappear; everything else is unchanged', async () => {
    const file = tmpMapping();
    __resetScenarioCache(file);
    const before = await snapshot();
    fs.rmSync(file);
    __resetScenarioCache(file);
    const after = await snapshot();

    expect(before.detail.diagnosis.target).toMatchObject({ kind: 'scenario', href: '/scenarios/office' });
    expect(after.detail.diagnosis.target).toEqual({ kind: 'generic', label: 'View products', href: '/products' });
    expect(before.mapArg!.size).toBeGreaterThan(0);
    expect(after.mapArg).toEqual(new Map());

    const withoutTarget = (d: typeof before.detail) => ({ ...d, diagnosis: { ...d.diagnosis, target: null } });
    expect(withoutTarget(after.detail)).toEqual(withoutTarget(before.detail));
    expect(after.summary).toEqual(before.summary);
    expect(after.list).toEqual(before.list);
    expect(after.cards).toEqual(before.cards);
    expect(after.summaryPost).toBe(200);
  });
});
