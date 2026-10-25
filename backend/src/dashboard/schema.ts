import { z } from 'zod';

export const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek'] as const;
/**
 * Intent tiers named in data/README.md. The data labels them without defining them; v3 reads them with the common
 * purchase-funnel convention (see INTENT_LABELS) and never re-labels a question.
 */
export const INTENTS = ['S', 'A', 'B', 'C'] as const;
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

// Response bodies of /api/dashboard/*. The frontend imports these types instead of keeping a copy.

/** Every filter value present in the data, so the UI never hard-codes platforms or topics. */
export interface Facets {
  platforms: Platform[];
  topics: string[];
  intents: string[];
}

export interface QuestionPageResponse {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
  facets: Facets;
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

/** Display order of the intent tiers: awareness → decision (05 §2.6). `SummaryV3DTO.intents` comes in this order. */
export const INTENT_DISPLAY_ORDER = ['C', 'B', 'A', 'S'] as const satisfies ReadonlyArray<IntentTier>;

/** ⓘ text wherever intent tiers are shown (05 §1). */
export const INTENT_TIERS_DISCLAIMER =
  'Intent tiers follow the common purchase-funnel convention (S decision · A evaluation · B solution · C awareness). The dataset labels tiers but does not define them.';

/** Footnote of the sources card (05 §2.7, F4): source_type and "owned" are two different things. */
export const SOURCE_TYPE_NOTE = `Source type is the dataset's label for the cited page; "owned" is decided by domain.`;

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

/**
 * One funnel step. Every rate names its denominator:
 *   rateOfAsked    = value ÷ questions (Asked)
 *   rateOfPrevious = value ÷ the previous step (for `mentions` the previous step IS Asked, so both are equal)
 * deltaPt is the change of rateOfAsked: last 15 days − first 15 days, in pt; null when either half has n < 8.
 */
export interface FunnelStep {
  value: number;
  rateOfAsked: number;
  rateOfPrevious: number;
  deltaPt: number | null;
}

/** Funnel KPI: Asked → Mentioned → Recommended (nested) + two side metrics that are NOT nested (F6). */
export interface FunnelKpi {
  /** Asked. A count has no pt delta. */
  questions: { value: number };
  mentions: FunnelStep;
  recommendations: FunnelStep;
  /** questions with ≥ 1 citation ÷ mentions; deltaPt is the change of rateOfMentioned */
  sourceBacked: { cited: number; rateOfMentioned: number; deltaPt: number | null };
  /** owned-domain citations ÷ all citations; deltaPt is the change of shareOfCitations */
  ownedSource: { owned: number; totalCitations: number; shareOfCitations: number; deltaPt: number | null };
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
  /** YYYY-MM-DD of that latest run, for the tooltip "Latest run <Mon D>"; null when not_tracked */
  latestDate: string | null;
}
/**
 * The five-state rule of one cell (05 §2.3) from its counts — the ONE implementation: the backend matrix
 * (aggregations/matrix.ts) and the detail page's replica (frontend detail/coverage.ts) both call it.
 * all runs recommended → "r/n" · some → "r/n" partly · none but mentioned → "M" · never mentioned → "✕" · no run → "—".
 */
export function matrixCellLook(n: number, recommended: number, mentioned: number): Pick<MatrixCell, 'state' | 'label'> {
  if (n === 0) return { state: 'not_tracked', label: '—' };
  if (recommended === n) return { state: 'recommended', label: `${recommended}/${n}` };
  if (recommended > 0) return { state: 'partly', label: `${recommended}/${n}` };
  if (mentioned > 0) return { state: 'mentioned_only', label: 'M' };
  return { state: 'not_mentioned', label: '✕' };
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
/**
 * Question × platform matrix. RULE (I7): the matrix applies only the `topic` and `intent` filters and IGNORES
 * `platform` — it always has the 5 PLATFORMS columns and `stateCounts` always counts all 5 columns, so "filtered
 * out" never shows up as "not tracked". When a platform filter is set, `collapsedByDefault` is true: the UI starts
 * collapsed with an expand button (and the 06 §5.2 hint), instead of drawing a one-column matrix.
 */
export interface MatrixDTO {
  /** = PLATFORMS, always all five */
  platforms: readonly Platform[];
  /** all rows (32 on the full data), gapScore desc then question asc; the UI decides Top-12 / Show all */
  rows: MatrixRow[];
  /** over the rows above × all 5 columns (topic / intent filtered, platform filter ignored) */
  stateCounts: Record<MatrixState, number>;
  /** true iff the request had a platform filter */
  collapsedByDefault: boolean;
}

/** Platform card, ratio version. Counts are included for tooltips such as "25% (6/24)". */
export interface PlatformRow {
  name: Platform;
  n: number;
  mentions: number;
  recommendations: number;
  /** questions with ≥ 1 citation */
  cited: number;
  /** mentions ÷ n */
  visibility: number;
  /** recommendations ÷ n */
  recommendationRateOfAsked: number;
  /** cited ÷ mentions */
  sourceBackedRateOfMentioned: number;
  isWorst: boolean;
}

/** 7-day rolling trend point. */
export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string;
  /** mentions ÷ questions that day; null when the day has no question (e.g. under a filter) — draw no point */
  dailyVisibility: number | null;
  /** questions that day (4 on the unfiltered data, can be 0 under a filter) */
  dailyN: number;
  /** numerator / denominator of dailyVisibility, for "Aug 4 · 4/4 mentioned (n=4)" (05 §2.5); 0 on an empty day.
   *  dailyQuestions === dailyN (dailyN is kept for existing readers). */
  dailyMentions: number;
  dailyQuestions: number;
  /** 7-day window ending this day; null for the first 6 days (window not full) and when the window has 0 questions */
  rollingVisibility: number | null;
  /** questions in the window (28 when full and unfiltered) */
  rollingN: number;
  /** numerator / denominator of the window, for "7-day: 22/28 (79%)"; counted even while the window is not full
   *  (rollingVisibility is still null then); 0 for an empty window. rollingQuestions === rollingN. */
  rollingMentions: number;
  rollingQuestions: number;
}

export interface IntentRow {
  tier: IntentTier;
  /** = INTENT_LABELS[tier].name */
  label: string;
  questions: number;
  mentions: number;
  recommendations: number;
  /** mentions ÷ questions; 0 when questions = 0 (do not draw it — see isEmpty) */
  visibility: number;
  /** recommendations ÷ questions; 0 when questions = 0 */
  recommendationRateOfAsked: number;
  /** true when questions = 0 → the UI draws a "Not tracked" placeholder, not a 0% bar */
  isEmpty: boolean;
}

export interface SourceStructure {
  /** source_type label distribution (Industry / Review / Media / Official), count desc */
  byType: Array<{ type: string; count: number }>;
  topDomains: Array<{ domain: string; count: number; owned: boolean }>;
  /** owned-domain citations ÷ all citations */
  ownedShare: { owned: number; totalCitations: number; shareOfCitations: number };
  /** non-zero platforms only, count desc */
  ownedByPlatform: Array<{ platform: Platform; count: number }>;
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
  /** always 4 rows, in INTENT_DISPLAY_ORDER (C, B, A, S) */
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
  /** where to act in P2; null for healthy. kind 'scenario' → the UI labels it "manual mapping" */
  target: ActionTarget | null;
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

/** Severity, most severe first. */
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One unit vocabulary for evidence numbers and for numbers extracted from a summary. */
export type NumberUnit = 'pct' | 'pt' | 'count';

/**
 * A number shown as evidence. The frontend formats it from `unit` (pct → "46%", pt → "▼ 12 pt", count → "29"),
 * so no number is ever baked into a string. `of` is an optional denominator count, e.g. 7 of 71 → "7/71".
 */
export interface EvidenceDatum {
  label: string;
  value: number;
  unit: NumberUnit;
  of?: number;
}

/**
 * Action rules (05 §3), in tie-break order. `affectedQuestions` per rule, over the filtered rows:
 *   no-source-no-mention    — not mentioned AND no citation
 *   visibility-declining    — not mentioned, dated in the last 15 days (PeriodHalves.last)
 *   weak-platform           — not mentioned, on the weakest platform
 *   mention-not-recommended — mentioned AND not recommended
 *   weak-topic              — not mentioned, in the weakest topic
 *   owned-source-share      — has citations, none of them on the owned domain
 *   decision-tier-untracked — questions in tier S (0 whenever the rule fires)
 */
export const RULE_IDS = [
  'no-source-no-mention',
  'visibility-declining',
  'weak-platform',
  'mention-not-recommended',
  'weak-topic',
  'owned-source-share',
  'decision-tier-untracked',
] as const;
export type RuleId = (typeof RULE_IDS)[number];
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
  /** impact, defined per rule on RULE_IDS; the second sort key */
  affectedQuestions: number;
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

/** The one card order (I5): severity, then affectedQuestions desc, then RULE_IDS order. Use with Array.sort. */
export function compareActionCards(a: ActionCard, b: ActionCard): number {
  return (
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    b.affectedQuestions - a.affectedQuestions ||
    RULE_IDS.indexOf(a.id) - RULE_IDS.indexOf(b.id)
  );
}

/**
 * The only input the LLM ever sees (B2 brief §2): rule-engine facts, never raw questions.json rows.
 * Every number a summary may cite must be reachable from here — verify.ts flattens it to check them.
 */
export interface LlmFacts {
  brand: string;
  period: { from: string; to: string };
  /** Rates are pct; the suffix names the denominator (Asked = questions, Mentioned = mentions). */
  funnel: {
    questions: number;
    mentions: number;
    mentionRateOfAsked: number;
    recommendations: number;
    recommendRateOfAsked: number;
    recommendRateOfMentioned: number;
  };
  /** change of mentionRateOfAsked, last 15 days − first 15 days, in pt; null when a half has n < 8 */
  delta: { mentionRateOfAskedPt: number | null; firstN: number; lastN: number };
  sources: { ownedShareOfCitations: number; totalCitations: number };
  /** from the already-sorted cards, first 5 */
  topFindings: Array<{ severity: Severity; finding: string; evidence: EvidenceDatum[] }>;
}

/** What the Generate button asks for. */
export type SummaryMode = 'ai' | 'rules';
/** What actually produced the text (I4). The UI decides badges from this alone: Rules / AI summary · <model> / Mock LLM (demo). */
export type SummaryResultMode = 'rules' | 'ai' | 'mock';

/** A number found in the summary text. `raw` = text.slice(start, end); `end` is exclusive (I3). */
export interface ExtractedNumber {
  raw: string;
  value: number;
  unit: NumberUnit;
  start: number;
  end: number;
}
export interface VerifiedNumber extends ExtractedNumber {
  verified: boolean;
  /** path of the matching fact in LlmFacts, e.g. "funnel.mentionRate" */
  matchedFact?: string;
}
/**
 * Number check result (I2). band: total = 0 or verified = total → 'all'; verified / total < 0.5 → 'low';
 * otherwise 'partial'. 'low' shows the low-verification badge; every unverified number is marked red in any band.
 */
export interface Verification {
  verified: number;
  total: number;
  band: 'all' | 'partial' | 'low';
}

/** The I2 band rule, in one place. */
export function verificationOf(verified: number, total: number): Verification {
  const band = total === 0 || verified === total ? 'all' : verified / total < 0.5 ? 'low' : 'partial';
  return { verified, total, band };
}

export interface LlmSummaryResult {
  /** what produced the text: a failed 'ai' request comes back as 'rules' with `reason` set */
  mode: SummaryResultMode;
  text: string;
  /** in text order; the UI marks [start, end) of every unverified number */
  numbers: VerifiedNumber[];
  verification: Verification;
  /** model id for display in 'ai' mode; the mock's id in 'mock' mode; null in 'rules' mode. Never compare it. */
  model: string | null;
  /** why an 'ai' request fell back to 'rules'; null otherwise. unknown_provider = LLM_PROVIDER names no known provider */
  reason?: 'no_api_key' | 'unknown_provider' | 'timeout' | 'upstream_error' | null;
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
