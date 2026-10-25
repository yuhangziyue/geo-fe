import { z } from 'zod';
import { problem } from '../shared/problem';
import { simulateMode, sleep } from '../shared/simulate';
import { periodDays, periodHalves } from './aggregations/period';
import { buildActions, factsForLlm, isOwnedUrl } from './insight';
import { dispatchSummary } from './llm/dispatcher';
import { applyFilter, computeSummary } from './metrics';
import { loadBrand, loadFacets, loadQuestions, loadTopicScenarios, productSlugs } from './repo';
import {
  GlobalFilterSchema,
  PLATFORMS,
  QuestionQueryV3Schema,
  SummaryRequestSchema,
  verificationOf,
  type ActionCardsResponse,
  type ActionTarget,
  type Diagnosis,
  type GlobalFilter,
  type LlmFacts,
  type LlmSummaryResult,
  type Question,
  type QuestionDetailV3,
  type QuestionDetailV3Response,
  type QuestionPageResponse,
  type SummaryV3DTO,
  type SummaryV3Response,
  type TopicScenarioMap,
} from './schema';

type Handler<C = unknown> = (req: Request, ctx?: C) => Promise<Response>;
export type IdContext = { params: Promise<{ id: string }> };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Query string → plain object, dropping empty values so `?platform=` means "no filter". */
function queryObject(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (v !== '' && k !== 'simulate') out[k] = v;
  return out;
}

function invalid(err: z.ZodError): Response {
  const detail = err.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join('; ');
  return problem(400, 'Invalid parameters', detail);
}

/** Wraps a handler with ?simulate=slow|error|empty and a 500 guard. */
function withSimulate<C>(empty: () => unknown, fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    const mode = simulateMode(new URL(req.url));
    if (mode === 'slow') await sleep(1500);
    if (mode === 'error') return problem(500, 'Simulated error', 'Triggered by ?simulate=error');
    if (mode === 'empty') return json(empty());
    try {
      return await fn(req, ctx);
    } catch (e) {
      console.error('[dashboard]', e);
      return problem(500, 'Internal error', e instanceof Error ? e.message : undefined);
    }
  };
}

/** The global filter (platform / topic / intent) from the query string; other keys are ignored. */
const parseFilter = (req: Request) => GlobalFilterSchema.safeParse(queryObject(new URL(req.url)));

/** Empty v3 summary: zeros, empty lists, the matrix still names its five columns. */
function emptySummary(): SummaryV3DTO {
  const { brand, period } = loadBrand();
  const zero = { value: 0, rateOfAsked: 0, rateOfPrevious: 0, deltaPt: null };
  return {
    brand,
    period,
    filter: {},
    funnel: {
      questions: { value: 0 },
      mentions: zero,
      recommendations: zero,
      sourceBacked: { cited: 0, rateOfMentioned: 0, deltaPt: null },
      ownedSource: { owned: 0, totalCitations: 0, shareOfCitations: 0, deltaPt: null },
    },
    platforms: [],
    trend: [],
    topics: [],
    intents: [],
    sources: { byType: [], topDomains: [], ownedShare: { owned: 0, totalCitations: 0, shareOfCitations: 0 }, ownedByPlatform: [] },
    matrix: {
      platforms: PLATFORMS,
      rows: [],
      stateCounts: { recommended: 0, partly: 0, mentioned_only: 0, not_mentioned: 0, not_tracked: 0 },
      collapsedByDefault: false,
    },
    periodHalves: periodHalves([], periodDays(loadQuestions())),
  };
}

export const getSummary = withSimulate(
  (): SummaryV3Response => ({ ...emptySummary(), facets: loadFacets() }),
  async (req) => {
    const parsed = parseFilter(req);
    if (!parsed.success) return invalid(parsed.error);
    return json({ ...computeSummary(loadQuestions(), parsed.data), facets: loadFacets() } satisfies SummaryV3Response);
  },
);

function matchesText(q: Question, needle: string): boolean {
  const n = needle.toLowerCase();
  return [q.question, q.answer_excerpt, ...q.mentioned_products, ...q.citations.flatMap((c) => [c.url, c.title])].some(
    (s) => s.toLowerCase().includes(n),
  );
}

export const listQuestions = withSimulate(
  (): QuestionPageResponse => ({ items: [], total: 0, page: 1, pageSize: 20, facets: loadFacets() }),
  async (req) => {
    const parsed = QuestionQueryV3Schema.safeParse(queryObject(new URL(req.url)));
    if (!parsed.success) return invalid(parsed.error);
    const f = parsed.data;
    const rows = applyFilter(loadQuestions(), f).filter(
      (q) =>
        (f.mentioned === undefined || q.brand_mentioned === f.mentioned) &&
        (f.recommended === undefined || q.brand_recommended === f.recommended) &&
        (!f.q || matchesText(q, f.q)),
    );
    const start = (f.page - 1) * f.pageSize;
    return json({
      items: rows.slice(start, start + f.pageSize),
      total: rows.length,
      page: f.page,
      pageSize: f.pageSize,
      facets: loadFacets(),
    } satisfies QuestionPageResponse);
  },
);

const GENERIC_TARGET: ActionTarget = { kind: 'generic', label: 'View products', href: '/products' };

/** Topic → scenario page ("manual mapping" in the UI); undefined when unmapped, null, or the mapping file is gone. */
function scenarioTarget(topic: string, scenarios: TopicScenarioMap): ActionTarget | undefined {
  const s = scenarios.get(topic);
  return s ? { kind: 'scenario', label: `Open ${s.name} scenario`, href: `/scenarios/${s.slug}` } : undefined;
}

/** First product named in the answer that has a Knowledge Center page. */
function firstProduct(q: Question, slugs: ReadonlyMap<string, string>): { name: string; slug: string } | undefined {
  const name = q.mentioned_products.find((p) => slugs.has(p));
  return name ? { name, slug: slugs.get(name)! } : undefined;
}

/**
 * Diagnosis card (05 §2.8): the first matching rule wins. Targets go product-level first (A′); a scenario target is
 * the hand-curated topic mapping; everything else falls back to /products.
 */
export function diagnose(q: Question, scenarios: TopicScenarioMap, slugs: ReadonlyMap<string, string>): Diagnosis {
  const extra = q.sentiment === 'mixed' ? { extra: ['Answer tone is mixed'] } : {};
  const product = firstProduct(q, slugs);
  if (!q.brand_mentioned) {
    return {
      code: 'content_gap',
      title: 'Content gap',
      action: 'AI answered without the brand. Publish citable content for this question.',
      target: scenarioTarget(q.topic, scenarios) ?? GENERIC_TARGET,
      ...extra,
    };
  }
  if (!q.brand_recommended) {
    return {
      code: 'persuasion_gap',
      title: 'Persuasion gap',
      action: 'Mentioned but not recommended. Strengthen differentiators and proof for the products named.',
      target: product
        ? { kind: 'product', label: `Edit ${product.name}`, href: `/admin/products/${product.slug}/edit` }
        : (scenarioTarget(q.topic, scenarios) ?? GENERIC_TARGET),
      ...extra,
    };
  }
  if (!q.citations.some((c) => isOwnedUrl(c.url))) {
    return {
      code: 'source_gap',
      title: 'Source gap',
      action: 'Recommended on third-party sources only. Add first-party pages AI can cite.',
      target: product ? { kind: 'product', label: `Open ${product.name}`, href: `/products/${product.slug}` } : GENERIC_TARGET,
      ...extra,
    };
  }
  return { code: 'healthy', title: 'Healthy', action: 'Keep this content fresh.', target: null, ...extra };
}

export const getQuestion = withSimulate<IdContext>(
  (): QuestionDetailV3Response => ({
    question: null,
    diagnosis: null,
    crossPlatform: [],
    analysis: { citationDomains: [], ownedCitations: 0, products: [] },
  }),
  async (_req, ctx) => {
    const raw = (await ctx?.params)?.id ?? '';
    const id = z.coerce.number().int().positive().safeParse(raw);
    if (!id.success) return problem(400, 'Invalid parameters', `id: expected a positive integer, got "${raw}"`);
    const all = loadQuestions();
    const question = all.find((q) => q.id === id.data);
    if (!question) return problem(404, 'Question not found', `No question with id ${id.data}`);

    const crossPlatform = all
      .filter((q) => q.prompt_id === question.prompt_id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map(({ id, platform, date, brand_mentioned, brand_recommended, answer_excerpt }) => ({
        id,
        platform,
        date,
        mentioned: brand_mentioned,
        recommended: brand_recommended,
        answer_excerpt,
      }));

    const domains = new Map<string, number>();
    for (const c of question.citations) {
      const host = new URL(c.url).hostname;
      domains.set(host, (domains.get(host) ?? 0) + 1);
    }
    const citationDomains = [...domains.entries()]
      .map(([domain, count]) => ({ domain, count, owned: isOwnedUrl(`https://${domain}`) }))
      .sort((a, b) => b.count - a.count);
    const slugs = productSlugs();

    return json({
      question,
      diagnosis: diagnose(question, loadTopicScenarios(), slugs),
      crossPlatform,
      analysis: {
        citationDomains,
        ownedCitations: question.citations.filter((c) => isOwnedUrl(c.url)).length,
        products: question.mentioned_products.map((name) => ({ name, slug: slugs.get(name) ?? null })),
      },
    } satisfies QuestionDetailV3);
  },
);

/** Rule cards + the fact sheet built from them (B2's buildActions / factsForLlm). No LLM here. */
function actionCenter(filter: GlobalFilter): ActionCardsResponse {
  const all = loadQuestions();
  const cards = buildActions(all, filter, loadTopicScenarios());
  const { brand, funnel, periodHalves: halves, sources } = computeSummary(all, filter);
  return { cards, facts: factsForLlm(cards, { brand, funnel, periodHalves: halves, sources }) };
}

function emptyFacts(): LlmFacts {
  const s = emptySummary();
  const days = periodDays(loadQuestions());
  return {
    brand: s.brand,
    period: { from: days[0] ?? '', to: days[days.length - 1] ?? '' },
    funnel: { questions: 0, mentions: 0, mentionRateOfAsked: 0, recommendations: 0, recommendRateOfAsked: 0, recommendRateOfMentioned: 0 },
    delta: { mentionRateOfAskedPt: null, firstN: 0, lastN: 0 },
    sources: { ownedShareOfCitations: 0, totalCitations: 0 },
    topFindings: [],
  };
}

export const getActionCards = withSimulate(
  (): ActionCardsResponse => ({ cards: [], facts: emptyFacts() }),
  async (req) => {
    const parsed = parseFilter(req);
    if (!parsed.success) return invalid(parsed.error);
    return json(actionCenter(parsed.data) satisfies ActionCardsResponse);
  },
);

/** POST body: { mode, platform?, topic?, intent? }. Fallback (no key / timeout / error) lives in dispatchSummary. */
export const postActionSummary = withSimulate(
  (): LlmSummaryResult => ({ mode: 'rules', text: '', numbers: [], verification: verificationOf(0, 0), model: null, reason: null }),
  async (req) => {
    let body: unknown;
    try {
      body = JSON.parse((await req.text()) || 'null');
    } catch {
      return problem(400, 'Invalid JSON body');
    }
    const parsed = SummaryRequestSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    const { mode, ...filter } = parsed.data;
    const { facts } = actionCenter(filter);
    return json((await dispatchSummary(mode, facts)) satisfies LlmSummaryResult);
  },
);
