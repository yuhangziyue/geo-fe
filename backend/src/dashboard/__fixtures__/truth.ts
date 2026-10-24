/**
 * Test truths for P1 v3 — the ONLY place unit tests may take expected numbers from (no hand-typed numbers in tests).
 *
 * Source: 05-p1-v3-product-spec §0 + 07 impl plan §A, all recomputed from data/project1_dashboard/questions.json.
 * `truth.test.ts` next to this file recomputes every value from the data with independent code, so a typo here
 * turns red before anything downstream asserts against it.
 *
 * Percentages are `pct()` (integer, round-half-to-even), e.g. 15/24 = 62.5 → 62.
 * Owned = domain `astervision.example` (an assumption, see OWNED_DOMAIN_DISCLAIMER in schema.ts).
 * Owner: T0. Sub-tasks import from here and never edit it; a wrong value is reported, not patched locally.
 */
import type { IntentTier, MatrixState, Platform, RuleId, Severity } from '../schema';

/** Nested funnel Asked → Mentioned → Recommended (05 §2.2). */
export const TRUTH_FUNNEL = {
  questions: 120,
  mentions: 85,
  recommendations: 56,
  /** mentions / questions */
  mentionRate: 71,
  /** recommendations / mentions (conversion) */
  rateOfMentions: 66,
  /** recommendations / questions */
  rateOfQuestions: 47,
} as const;

/** Side metric, not nested: questions with ≥1 citation ÷ mentions (F6). */
export const TRUTH_SOURCE_BACKED = { cited: 42, mentions: 85, pct: 49 } as const;

/** Owned-domain citations ÷ all citations (F4). */
export const TRUTH_OWNED_SHARE = { owned: 7, total: 71, pct: 10 } as const;

export interface PlatformTruth {
  name: Platform;
  n: number;
  mentions: number;
  recommendations: number;
  cited: number;
  visibility: number;
  recommendationRate: number;
  /** cited ÷ mentions */
  sourceBackedRate: number;
  ownedCitations: number;
  isWorst: boolean;
}

/** In PLATFORMS order (§A, F8). */
export const TRUTH_PLATFORMS: readonly PlatformTruth[] = [
  { name: 'ChatGPT', n: 25, mentions: 19, recommendations: 13, cited: 10, visibility: 76, recommendationRate: 52, sourceBackedRate: 53, ownedCitations: 2, isWorst: false },
  { name: 'Gemini', n: 23, mentions: 20, recommendations: 12, cited: 7, visibility: 87, recommendationRate: 52, sourceBackedRate: 35, ownedCitations: 0, isWorst: false },
  { name: 'Claude', n: 24, mentions: 15, recommendations: 10, cited: 10, visibility: 62, recommendationRate: 42, sourceBackedRate: 67, ownedCitations: 0, isWorst: false },
  { name: 'Perplexity', n: 24, mentions: 20, recommendations: 15, cited: 11, visibility: 83, recommendationRate: 62, sourceBackedRate: 55, ownedCitations: 4, isWorst: false },
  { name: 'DeepSeek', n: 24, mentions: 11, recommendations: 6, cited: 4, visibility: 46, recommendationRate: 25, sourceBackedRate: 36, ownedCitations: 1, isWorst: true },
];

/** First / last 15 days and the period delta (F5). Dates inclusive. */
export const TRUTH_PERIOD = {
  first: { from: '2026-08-01', to: '2026-08-15', n: 60, mentions: 46, pct: 77 },
  last: { from: '2026-08-16', to: '2026-08-30', n: 60, mentions: 39, pct: 65 },
  /** last.pct − first.pct, in percentage points */
  deltaPt: -12,
  /** Below this n in either half, delta is null ("Too few samples", 05 §1). */
  minN: 8,
} as const;

/** 7-day rolling visibility (F1, 05 §2.5). Window = [from .. date] inclusive. */
export const TRUTH_TREND = {
  days: 30,
  /** Every day has exactly 4 questions. */
  dailyN: 4,
  /** The first 6 days have no full window → rollingVisibility null. */
  leadingNullDays: 6,
  rolling: [
    { date: '2026-08-07', from: '2026-08-01', n: 28, mentions: 22, pct: 79 },
    { date: '2026-08-30', from: '2026-08-24', n: 28, mentions: 20, pct: 71 },
  ],
} as const;

export interface IntentTruth {
  tier: IntentTier;
  questions: number;
  mentions: number;
  recommendations: number;
  mentionRate: number;
  recommendationRate: number;
}

/** Intent tiers in display order C → B → A → S (05 §2.6). S has no questions: render "Not tracked", not 0%. */
export const TRUTH_INTENTS: readonly IntentTruth[] = [
  { tier: 'C', questions: 45, mentions: 34, recommendations: 19, mentionRate: 76, recommendationRate: 42 },
  { tier: 'B', questions: 15, mentions: 12, recommendations: 9, mentionRate: 80, recommendationRate: 60 },
  { tier: 'A', questions: 60, mentions: 39, recommendations: 28, mentionRate: 65, recommendationRate: 47 },
  { tier: 'S', questions: 0, mentions: 0, recommendations: 0, mentionRate: 0, recommendationRate: 0 },
];

/** Per-topic visibility; Office Security is the single weakest topic (drives the `weak-topic` card). */
export const TRUTH_TOPICS: ReadonlyArray<{ topic: string; questions: number; mentions: number; visibility: number; isWorst: boolean }> = [
  { topic: 'Industrial Monitoring', questions: 15, mentions: 11, visibility: 73, isWorst: false },
  { topic: 'Low-light Imaging', questions: 15, mentions: 10, visibility: 67, isWorst: false },
  { topic: 'Office Security', questions: 15, mentions: 8, visibility: 53, isWorst: true },
  { topic: 'Perimeter Protection', questions: 15, mentions: 11, visibility: 73, isWorst: false },
  { topic: 'Product Comparison', questions: 15, mentions: 10, visibility: 67, isWorst: false },
  { topic: 'Retail Analytics', questions: 15, mentions: 11, visibility: 73, isWorst: false },
  { topic: 'SMB Deployment', questions: 15, mentions: 12, visibility: 80, isWorst: false },
  { topic: 'Warehouse Security', questions: 15, mentions: 12, visibility: 80, isWorst: false },
];

/** `source_type` label distribution, count descending (05 §2.7). Sums to TRUTH_OWNED_SHARE.total. */
export const TRUTH_SOURCE_TYPES = [
  { type: 'Industry', count: 21 },
  { type: 'Review', count: 19 },
  { type: 'Media', count: 18 },
  { type: 'Official', count: 13 },
] as const;

/**
 * Top 6 citation domains. The last two tie at 7: the truth table does not fix their relative order,
 * so tests must not assert it (compare as a set or by domain).
 */
export const TRUTH_TOP_DOMAINS = [
  { domain: 'retailops.example', count: 17, owned: false },
  { domain: 'securitytoday.example', count: 15, owned: false },
  { domain: 'techreview.example', count: 14, owned: false },
  { domain: 'iotworld.example', count: 11, owned: false },
  { domain: 'industryvision.example', count: 7, owned: false },
  { domain: 'astervision.example', count: 7, owned: true },
] as const;

/** Prompt / run shape of the dataset (F2 + 07 22:30 recheck). */
export const TRUTH_DATA_SHAPE = {
  distinctQuestions: 32,
  /** runs per question → number of questions */
  runsPerQuestion: { 3: 8, 4: 24 },
  /** distinct platforms per question → number of questions */
  platformsPerQuestion: { 2: 15, 3: 17 },
} as const;

/** Question × platform matrix (05 §2.3). 32 × 5 = 160 cells. */
export const TRUTH_MATRIX = {
  rows: 32,
  columns: 5,
  trackedCells: 81,
  /** runs per tracked cell → number of cells */
  runsPerCell: { 1: 42, 2: 39 },
  stateCounts: { recommended: 28, partly: 19, mentioned_only: 17, not_mentioned: 17, not_tracked: 79 } satisfies Record<MatrixState, number>,
  defaultRows: 12,
  /** gapScore = notMentionedCells × 2 + mentionedOnlyCells × 1; sorted desc, ties by question text asc. */
  top12GapScores: [4, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2],
} as const;

/** Cross-facts behind the action rules (F3, F6, 05 §0 truth list). */
export const TRUTH_F3_F6 = {
  notMentioned: 35,
  /** All 35 unmentioned answers have zero citations. */
  notMentionedWithoutCitations: 35,
  citedQuestions: 42,
  /** Every cited answer mentions the brand. */
  citedAndMentioned: 42,
  recommendedWithoutCitations: 24,
  citedNotRecommended: 10,
  mentionedNotRecommended: 29,
  recommendedWithoutOwned: 51,
} as const;

/** Action center on the full dataset: all 7 rules fire, in this order (severity, then impact). */
export const TRUTH_ACTION_CARDS = [
  { id: 'no-source-no-mention', severity: 'high' },
  { id: 'visibility-declining', severity: 'high' },
  { id: 'weak-platform', severity: 'high' },
  { id: 'mention-not-recommended', severity: 'medium' },
  { id: 'weak-topic', severity: 'medium' },
  { id: 'owned-source-share', severity: 'medium' },
  { id: 'decision-tier-untracked', severity: 'low' },
] as const satisfies ReadonlyArray<{ id: RuleId; severity: Severity }>;

/**
 * Every %-truth above, de-duplicated and ascending. Derived, never hand-listed, so it cannot drift from the table.
 * Used by B2's mockProvider test: the deliberately wrong number must be ≥ 2 pt away from all of these.
 * Excludes the empty S tier (its 0% is a placeholder, not a measurement) and the pt delta (see TRUTH_PT_VALUES).
 */
export const TRUTH_PCT_VALUES: readonly number[] = [
  ...new Set<number>([
    TRUTH_FUNNEL.mentionRate,
    TRUTH_FUNNEL.rateOfMentions,
    TRUTH_FUNNEL.rateOfQuestions,
    TRUTH_SOURCE_BACKED.pct,
    TRUTH_OWNED_SHARE.pct,
    ...TRUTH_PLATFORMS.flatMap((p) => [p.visibility, p.recommendationRate, p.sourceBackedRate]),
    TRUTH_PERIOD.first.pct,
    TRUTH_PERIOD.last.pct,
    ...TRUTH_TREND.rolling.map((w) => w.pct),
    ...TRUTH_INTENTS.filter((t) => t.questions > 0).flatMap((t) => [t.mentionRate, t.recommendationRate]),
    ...TRUTH_TOPICS.map((t) => t.visibility),
  ]),
].sort((a, b) => a - b);

/** Every pt-truth (period deltas). */
export const TRUTH_PT_VALUES: readonly number[] = [TRUTH_PERIOD.deltaPt];
