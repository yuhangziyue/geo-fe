import { z } from 'zod';

export const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek'] as const;
/**
 * Intent tiers named in data/README.md. The data labels them without defining them; v3 reads them with the common
 * purchase-funnel convention (see INTENT_LABELS) and never re-labels a question.
 */
export const INTENTS = ['S', 'A', 'B', 'C'] as const;
/** @deprecated e2 name, same tuple — use INTENTS. */
export const DOCUMENTED_INTENTS = INTENTS;
export const OWNED_DOMAIN = 'astervision.example';

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source_type: z.string(),
});

const QuestionShape = z.object({
  id: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(PLATFORMS),
  topic: z.string(),
  intent_type: z.string(),
  question: z.string(),
  brand_mentioned: z.boolean(),
  brand_recommended: z.boolean(),
  sentiment: z.string(),
  mentioned_products: z.array(z.string()),
  answer_excerpt: z.string(),
  citations: z.array(CitationSchema),
  citation_count: z.number().int(),
});

/** One row of questions.json, plus the business rules the shape alone cannot express. */
export const QuestionSchema = QuestionShape.superRefine((q, ctx) => {
  const fail = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (q.brand_recommended && !q.brand_mentioned) fail('brand_recommended', 'recommended without being mentioned');
  if (q.mentioned_products.length > 0 && !q.brand_mentioned) fail('mentioned_products', 'names a product but brand_mentioned is false');
  if (q.citation_count !== q.citations.length) fail('citation_count', `is ${q.citation_count}, citations has ${q.citations.length}`);
});

export type Citation = z.infer<typeof CitationSchema>;
/**
 * A row is one *run*: a prompt asked on one platform on one day. The same prompt is run several times
 * (3–4 runs, a platform may repeat on another day), so rows carry a derived `prompt_id`.
 */
export type Question = z.infer<typeof QuestionShape> & { prompt_id: string };
export type Platform = (typeof PLATFORMS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const SummaryFilterSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type SummaryFilter = z.infer<typeof SummaryFilterSchema>;

export const QuestionQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.string().min(1).optional(),
  mentioned: bool.optional(),
  recommended: bool.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type QuestionQuery = z.infer<typeof QuestionQuerySchema>;

/** @deprecated v2 body of POST /api/dashboard/insight — removed by B1 together with that route. */
export const InsightBodySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.string().min(1).optional(),
});

export interface MetricRow {
  visibility: number;
  mentions: number;
  recommendations: number;
  citations: number;
  citedQuestions: number;
  questions: number;
}

export interface ScenarioRef {
  slug: string;
  name: string;
}

/** Prompt-level coverage: does the brand show up every time the prompt is run, or never? */
export interface PromptCoverage {
  total: number;
  mentionedEverywhere: number;
  mentionedNowhere: number;
}

/** A prompt to fix, ranked by its worst run. `id` is that run, for the detail link. */
export interface PromptToFix {
  id: number;
  promptId: string;
  question: string;
  topic: string;
  /** Platforms of the worst runs (not mentioned, else mentioned but not recommended). */
  platforms: Platform[];
  badRuns: number;
  runs: number;
}

export interface SummaryDTO {
  brand: string;
  period: string;
  kpi: MetricRow;
  prompts: PromptCoverage;
  platforms: Array<MetricRow & { name: string }>;
  trend: Array<{ date: string; visibility: number; mentions: number; recommendations: number }>;
  /** `scenario`: the Knowledge Center page where this topic's content lives (hand-curated, may be null). */
  topics: Array<{ topic: string; questions: number; visibility: number; recommendations: number; scenario: ScenarioRef | null }>;
  intents: Array<{ intent: string; questions: number; visibility: number; recommendations: number }>;
  /** Documented intent types with no question in this selection. */
  missingIntents: string[];
  worstQuestions: PromptToFix[];
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  evidenceHref: string;
  /** Where to act on the finding, e.g. the Knowledge Center page to improve. */
  action?: { label: string; href: string };
}

// Response bodies of /api/dashboard/*. The frontend imports these types instead of keeping a copy.

/** Every filter value present in the data, so the UI never hard-codes platforms or topics. */
export interface Facets {
  platforms: Platform[];
  topics: string[];
  intents: string[];
}

/** @deprecated v2 body of GET /api/dashboard/summary — replaced by SummaryV3Response; removed by B1. */
export type SummaryResponse = SummaryDTO & { facets: Facets };

export interface QuestionPageResponse {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
  facets: Facets;
}

export interface QuestionDetailResponse {
  /** null only under ?simulate=empty. */
  question: Question | null;
  /** Other runs of the same prompt (other platforms, or the same platform on another day). */
  otherRuns: Array<{ id: number; platform: Platform; date: string; mentioned: boolean; recommended: boolean }>;
  analysis: {
    topicScenario: ScenarioRef | null;
    citationDomains: Array<{ domain: string; count: number; owned: boolean }>;
    ownedCitations: number;
    products: Array<{ name: string; slug: string | null }>;
  };
}

/** @deprecated v2 body of POST /api/dashboard/insight — replaced by ActionCardsResponse; removed by B1. */
export interface InsightResponse {
  insights: Insight[];
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// P1 v3 contract (T0). Everything below is the handshake between B1 / B2 / F1 / F2: import it, do not edit it.
// Rules: 05-p1-v3-product-spec · visuals: 06-p1-v3-design-spec · guide: frontend/components/dashboard/__contracts__/
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type IntentTier = (typeof INTENTS)[number];

/** Common purchase-funnel reading of the tiers (05 §1). The dataset labels tiers but does not define them. */
export const INTENT_LABELS: Record<IntentTier, { name: string; blurb: string; weight: number }> = {
  S: { name: 'Decision', blurb: 'Transactional — pricing, purchase, channels', weight: 4 },
  A: { name: 'Evaluation', blurb: 'Commercial — comparison, brand vs. brand', weight: 3 },
  B: { name: 'Solution', blurb: 'Scenario-fit recommendations', weight: 2 },
  C: { name: 'Awareness', blurb: 'Informational — explainers, when-to-use', weight: 1 },
};

/** F9: the owned domain is inferred, not given. Every owned-source metric / card / action card shows this text. */
export const OWNED_DOMAIN_DISCLAIMER =
  'Owned = astervision.example (assumed; brand.json lists example.com/astervision).';

/** Global filter: all three stack; `simulate` is passed through the URL but is not part of the filter. */
export const GlobalFilterSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.enum(INTENTS).optional(),
});
export type GlobalFilter = z.infer<typeof GlobalFilterSchema>;

/** URL keys of the global filter, in the order they are written to a URL. */
export const GLOBAL_FILTER_KEYS = ['platform', 'topic', 'intent'] as const satisfies ReadonlyArray<keyof GlobalFilter>;

/**
 * URL → filter. Each key is validated on its own: an invalid or empty value is dropped, the rest is kept
 * (a stale `?platform=Foo` must not wipe a valid `intent`). Non-filter keys (simulate, page, q…) are ignored.
 */
export function parseGlobalFilter(params: Pick<URLSearchParams, 'get'>): GlobalFilter {
  const out: GlobalFilter = {};
  for (const key of GLOBAL_FILTER_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    const parsed = GlobalFilterSchema.shape[key].safeParse(value);
    if (parsed.success && parsed.data !== undefined) Object.assign(out, { [key]: parsed.data });
  }
  return out;
}

/**
 * Filter → drill-down link. Writes platform, topic, intent (in that order), then `extra`; an `extra` key overrides
 * the filter key of the same name. Returns the bare path when there is nothing to carry.
 * Shared by the frontend hook (useGlobalFilter.buildHref) and the backend (ActionCard.evidenceHref).
 */
export function globalFilterHref(path: string, filter: GlobalFilter, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const key of GLOBAL_FILTER_KEYS) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Topic → Knowledge Center scenario (05 §1, hand-curated). Built by B1's `loadTopicScenarios()` from
 * `topic-scenario.json`; when that file is deleted the map is EMPTY and every consumer falls back to `/products`.
 *   map.get(topic) === undefined → no mapping known (file deleted / new topic)        → `/products`
 *   map.get(topic) === null      → deliberately no scenario (e.g. Product Comparison)  → `/products`
 *   map.get(topic) = ScenarioRef → `/scenarios/<slug>`, labelled "manual mapping" in the UI
 */
export type TopicScenarioMap = ReadonlyMap<string, ScenarioRef | null>;

/** Funnel KPI: three nested steps + two side metrics. deltaPt = last 15 days − first 15 days; null when a half has n < 8. */
export interface FunnelKpi {
  questions: { value: number; deltaPt: number | null };
  /** rate = mentions / questions */
  mentions: { value: number; rate: number; deltaPt: number | null };
  recommendations: { value: number; rateOfMentions: number; rateOfQuestions: number; deltaPt: number | null };
  /** cited questions / mentions */
  sourceBackedRate: { value: number; deltaPt: number | null };
  /** owned-domain citations / all citations */
  ownedSourceShare: { value: number; deltaPt: number | null };
}

export type MatrixState = 'recommended' | 'partly' | 'mentioned_only' | 'not_mentioned' | 'not_tracked';
export interface MatrixCell {
  state: MatrixState;
  /** runs in this cell (0 when not_tracked) */
  n: number;
  /** ≤ n */
  recommended: number;
  /** ≤ n */
  mentioned: number;
  /** "2/2" | "1/2" | "M" | "✕" | "—" */
  label: string;
  /** latest run, for the click-through to detail; null when not_tracked */
  latestRunId: number | null;
}
export interface MatrixRow {
  question: string;
  intent: IntentTier | null;
  topic: string;
  /** notMentionedCells × 2 + mentionedOnlyCells × 1 */
  gapScore: number;
  /** always 5 cells, in PLATFORMS order */
  cells: MatrixCell[];
}
export interface MatrixDTO {
  /** = PLATFORMS */
  platforms: readonly string[];
  /** all rows (32 on the full data), gapScore desc then question asc; the UI decides Top-12 / Show all */
  rows: MatrixRow[];
  stateCounts: Record<MatrixState, number>;
}

/** Platform card, ratio version. */
export interface PlatformRow {
  name: string;
  n: number;
  /** mentions / n */
  visibility: number;
  recommendationRate: number;
  /** cited / mentions */
  sourceBackedRate: number;
  isWorst: boolean;
}

/** 7-day rolling trend point. */
export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string;
  /** daily value: 0/25/50/75/100 on this data */
  dailyVisibility: number;
  /** 4 on this data */
  dailyN: number;
  /** null for the first 6 days (window not full) */
  rollingVisibility: number | null;
  /** questions in the window (28 when full) */
  rollingN: number;
}

export interface IntentRow {
  tier: IntentTier;
  /** = INTENT_LABELS[tier].name */
  label: string;
  questions: number;
  /** 0 when questions = 0 */
  mentionRate: number;
  recommendationRate: number;
  /** true when questions = 0 → the UI draws a "Not tracked" placeholder, not a 0% bar */
  isEmpty: boolean;
}

export interface SourceStructure {
  /** source_type label distribution (Industry / Review / Media / Official), count desc */
  byType: Array<{ type: string; count: number }>;
  topDomains: Array<{ domain: string; count: number; owned: boolean }>;
  ownedShare: { owned: number; total: number; pct: number };
  /** non-zero platforms only */
  ownedByPlatform: Array<{ platform: string; count: number }>;
}

export interface TopicRow {
  topic: string;
  questions: number;
  visibility: number;
  recommendations: number;
  isWorst: boolean;
}

/** First / last 15 days of the selection. */
export interface PeriodHalves {
  first: { from: string; to: string; n: number };
  last: { from: string; to: string; n: number };
}

export interface SummaryV3DTO {
  brand: string;
  period: string;
  filter: GlobalFilter;
  funnel: FunnelKpi;
  platforms: PlatformRow[];
  trend: TrendPoint[];
  topics: TopicRow[];
  intents: IntentRow[];
  sources: SourceStructure;
  matrix: MatrixDTO;
  periodHalves: PeriodHalves;
}

/** GET /api/dashboard/summary. `facets` come from the full data (not the filtered rows), as in e2 — they feed the FilterBar. */
export type SummaryV3Response = SummaryV3DTO & { facets: Facets };

/** GET /api/dashboard/questions: e2 list parameters + intent (S/A/B/C). The response stays QuestionPageResponse. */
export const QuestionQueryV3Schema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.enum(INTENTS).optional(),
  mentioned: bool.optional(),
  recommended: bool.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type QuestionQueryV3 = z.infer<typeof QuestionQueryV3Schema>;

/** Question detail: diagnosis card (05 §2.8), the first matching rule wins. */
export type DiagnosisCode = 'content_gap' | 'persuasion_gap' | 'source_gap' | 'healthy';
export interface Diagnosis {
  code: DiagnosisCode;
  title: string;
  action: string;
  /** where to act in P2; null for healthy */
  target: { label: string; href: string } | null;
  /** e.g. "Answer tone is mixed" */
  extra?: string[];
}
export interface QuestionDetailV3 {
  question: Question;
  diagnosis: Diagnosis;
  /** every run of the same question, this one included, so the UI can highlight the current run */
  crossPlatform: Array<{ id: number; platform: string; date: string; mentioned: boolean; recommended: boolean; answer_excerpt: string }>;
  analysis: {
    citationDomains: Array<{ domain: string; count: number; owned: boolean }>;
    ownedCitations: number;
    products: Array<{ name: string; slug: string | null }>;
  };
}
/** GET /api/dashboard/questions/[id]. The null shell is returned only under ?simulate=empty. */
export type QuestionDetailV3Response =
  | QuestionDetailV3
  | { question: null; diagnosis: null; crossPlatform: []; analysis: QuestionDetailV3['analysis'] };

// Action center (05 §3)

export type Severity = 'high' | 'medium' | 'low';
export interface EvidenceDatum {
  label: string;
  value: string | number;
}
export type RuleId =
  | 'no-source-no-mention'
  | 'visibility-declining'
  | 'weak-platform'
  | 'mention-not-recommended'
  | 'weak-topic'
  | 'owned-source-share'
  | 'decision-tier-untracked';
/** Product-level target first; 'scenario' must be labelled "manual mapping" in the UI (06 §5.8). */
export type TargetKind = 'product' | 'scenario' | 'generic';
export interface ActionTarget {
  kind: TargetKind;
  label: string;
  href: string;
}
export interface ActionCard {
  id: RuleId;
  severity: Severity;
  finding: string;
  /** numbers live here, structured — the frontend renders them, it never interpolates them into text */
  evidence: EvidenceDatum[];
  action: string;
  /** pre-filtered question list carrying the current global filter (build it with globalFilterHref) */
  evidenceHref: string;
  target: ActionTarget | null;
  /** F9: owned-source related cards carry OWNED_DOMAIN_DISCLAIMER */
  disclaimer?: string;
}

/**
 * The only input the LLM ever sees (B2 brief §2): rule-engine facts, never raw questions.json rows.
 * Every number a summary may cite must be reachable from here — verify.ts flattens it to check them.
 */
export interface LlmFacts {
  brand: string;
  period: { from: string; to: string };
  funnel: { questions: number; mentions: number; mentionRate: number; recommendations: number; recommendRate: number };
  delta: { mentionsPt: number | null; firstN: number; lastN: number };
  sources: { ownedShare: number; totalCitations: number };
  /** from the already-sorted cards, first 5 */
  topFindings: Array<{ severity: Severity; finding: string; evidence: EvidenceDatum[] }>;
}

export type SummaryMode = 'ai' | 'rules';
export type NumberUnit = '%' | 'pt' | '';
export interface ExtractedNumber {
  raw: string;
  value: number;
  unit: NumberUnit;
}
export interface VerifiedNumber extends ExtractedNumber {
  verified: boolean;
  /** path of the matching fact in LlmFacts, e.g. "funnel.mentionRate" */
  matchedFact?: string;
}
export interface LlmSummaryResult {
  /** the mode actually used: a failed 'ai' request comes back as 'rules' with `reason` set */
  mode: SummaryMode;
  text: string;
  numbers: VerifiedNumber[];
  /** e.g. "7/9"; "0/0" when the text has no numbers */
  verifiedRatio: string;
  /** ratio 1 → 'all'; 0 < ratio < 1 → 'partial'; 0 → 'none'; 0/0 → 'na' */
  verifiedBand: 'all' | 'partial' | 'none' | 'na';
  /** real model id in 'ai' mode ('mock-llm-v1' for the demo mock); null in 'rules' mode */
  model: string | null;
  reason?: 'no_api_key' | 'timeout' | 'upstream_error' | 'low_verification' | null;
}

/** GET /api/dashboard/action-center/cards?platform&topic&intent — loaded with the page. */
export interface ActionCardsResponse {
  cards: ActionCard[];
  /** returned with the cards, so the client needs no second call to know what the summary is built from */
  facts: LlmFacts;
}

/** POST /api/dashboard/action-center/summary body (Generate button). Always answers with a valid summary. */
export const SummaryRequestSchema = z.object({
  mode: z.enum(['ai', 'rules']),
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  intent: z.enum(INTENTS).optional(),
});
export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;
