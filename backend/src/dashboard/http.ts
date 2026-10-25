import { z } from 'zod';
import { problem } from '../shared/problem';
import { simulateMode, sleep } from '../shared/simulate';
import { buildInsights, isOwnedUrl } from './insight';
import { applyFilter, computeSummary } from './metrics';
import { loadBrand, loadFacets, loadQuestions, productSlugs, topicScenario } from './repo';
import {
  InsightBodySchema,
  QuestionQuerySchema,
  SummaryFilterSchema,
  type InsightResponse,
  type Question,
  type QuestionDetailResponse,
  type QuestionPageResponse,
  type SummaryResponse,
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

/** Topics come from the data, so the schema cannot enumerate them: check against the full dataset here. */
function unknownTopic(topic: string | undefined): Response | null {
  const topics = loadFacets().topics;
  if (!topic || topics.includes(topic)) return null;
  return problem(400, 'Invalid parameters', `topic: unknown value "${topic}"; expected one of ${topics.join(', ')}`);
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

export const getSummary = withSimulate(
  (): SummaryResponse => ({
    ...loadBrand(),
    kpi: { visibility: 0, mentions: 0, recommendations: 0, citations: 0, citedQuestions: 0, questions: 0 },
    prompts: { total: 0, mentionedEverywhere: 0, mentionedNowhere: 0 },
    platforms: [],
    trend: [],
    topics: [],
    intents: [],
    missingIntents: [],
    worstQuestions: [],
    facets: loadFacets(),
  }),
  async (req) => {
    const parsed = SummaryFilterSchema.safeParse(queryObject(new URL(req.url)));
    if (!parsed.success) return invalid(parsed.error);
    const badTopic = unknownTopic(parsed.data.topic);
    if (badTopic) return badTopic;
    return json({ ...computeSummary(loadQuestions(), parsed.data), facets: loadFacets() } satisfies SummaryResponse);
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
    const parsed = QuestionQuerySchema.safeParse(queryObject(new URL(req.url)));
    if (!parsed.success) return invalid(parsed.error);
    const badTopic = unknownTopic(parsed.data.topic);
    if (badTopic) return badTopic;
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

export const getQuestion = withSimulate<IdContext>(
  (): QuestionDetailResponse => ({
    question: null,
    otherRuns: [],
    analysis: { topicScenario: null, citationDomains: [], ownedCitations: 0, products: [] },
  }),
  async (_req, ctx) => {
    const raw = (await ctx?.params)?.id ?? '';
    const id = z.coerce.number().int().positive().safeParse(raw);
    if (!id.success) return problem(400, 'Invalid parameters', `id: expected a positive integer, got "${raw}"`);
    const all = loadQuestions();
    const question = all.find((q) => q.id === id.data);
    if (!question) return problem(404, 'Question not found', `No question with id ${id.data}`);

    const otherRuns = all
      .filter((q) => q.prompt_id === question.prompt_id && q.id !== question.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ id, platform, date, brand_mentioned, brand_recommended }) => ({
        id,
        platform,
        date,
        mentioned: brand_mentioned,
        recommended: brand_recommended,
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
      otherRuns,
      analysis: {
        topicScenario: topicScenario(question.topic),
        citationDomains,
        ownedCitations: question.citations.filter((c) => isOwnedUrl(c.url)).length,
        products: question.mentioned_products.map((name) => ({ name, slug: slugs.get(name) ?? null })),
      },
    } satisfies QuestionDetailResponse);
  },
);

export const postInsight = withSimulate(
  (): InsightResponse => ({ insights: [] }),
  async (req) => {
    let body: unknown = {};
    const text = await req.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return problem(400, 'Invalid JSON body');
      }
    }
    const parsed = InsightBodySchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    const badTopic = unknownTopic(parsed.data.topic);
    if (badTopic) return badTopic;
    return json({ insights: buildInsights(loadQuestions(), parsed.data) } satisfies InsightResponse);
  },
);
