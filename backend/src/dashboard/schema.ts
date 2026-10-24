import { z } from 'zod';

export const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek'] as const;
/** Intent types named in data/README.md. Their meaning is not defined there, so they are shown as labels only. */
export const DOCUMENTED_INTENTS = ['S', 'A', 'B', 'C'] as const;
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

export interface InsightResponse {
  insights: Insight[];
}
