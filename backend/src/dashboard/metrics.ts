import { loadBrand, topicScenario } from './repo';
import {
  DOCUMENTED_INTENTS,
  PLATFORMS,
  type MetricRow,
  type PromptCoverage,
  type PromptToFix,
  type Question,
  type SummaryDTO,
  type SummaryFilter,
} from './schema';

/**
 * Percentage rounded half-to-even, done in integers so 15/24 = 62.5 → 62,
 * matching the vendor's dashboard_summary.json (which was produced with banker's rounding).
 */
export function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  const num = part * 100;
  const q = Math.floor(num / whole);
  const twiceRem = 2 * (num - q * whole);
  if (twiceRem > whole) return q + 1;
  if (twiceRem < whole) return q;
  return q % 2 === 0 ? q : q + 1;
}

export function applyFilter(questions: Question[], f: SummaryFilter): Question[] {
  return questions.filter(
    (q) =>
      (!f.platform || q.platform === f.platform) &&
      (!f.topic || q.topic === f.topic) &&
      (!f.intent || q.intent_type === f.intent) &&
      (!f.from || q.date >= f.from) &&
      (!f.to || q.date <= f.to),
  );
}

export function metricRow(rows: Question[]): MetricRow {
  const mentions = rows.filter((q) => q.brand_mentioned).length;
  return {
    visibility: pct(mentions, rows.length),
    mentions,
    recommendations: rows.filter((q) => q.brand_recommended).length,
    citations: rows.reduce((n, q) => n + q.citations.length, 0),
    citedQuestions: rows.filter((q) => q.citations.length > 0).length,
    questions: rows.length,
  };
}

function groupBy<K>(rows: Question[], key: (q: Question) => K): Map<K, Question[]> {
  const m = new Map<K, Question[]>();
  for (const q of rows) {
    const k = key(q);
    m.set(k, [...(m.get(k) ?? []), q]);
  }
  return m;
}

/** Badness rank: not mentioned (2) > mentioned but not recommended (1) > recommended (0). */
export const badness = (q: Question) => (!q.brand_mentioned ? 2 : !q.brand_recommended ? 1 : 0);

/** Counts prompts, not rows: a prompt is covered only if every one of its runs mentions the brand. */
export function promptCoverage(rows: Question[]): PromptCoverage {
  const runs = [...groupBy(rows, (q) => q.prompt_id).values()];
  return {
    total: runs.length,
    mentionedEverywhere: runs.filter((r) => r.every((q) => q.brand_mentioned)).length,
    mentionedNowhere: runs.filter((r) => r.every((q) => !q.brand_mentioned)).length,
  };
}

/**
 * Content is fixed per prompt, so the list holds one entry per prompt. Ranked by its worst run, then by how
 * many runs left the brand out, then by how many runs fall short at all, then by id (stable).
 */
export function promptsToFix(rows: Question[], limit = 5): PromptToFix[] {
  const ranked = [...groupBy(rows, (q) => q.prompt_id).values()].flatMap((runs) => {
    const bad = runs.filter((q) => badness(q) > 0);
    if (bad.length === 0) return [];
    const worst = Math.max(...bad.map(badness));
    const worstRuns = bad.filter((q) => badness(q) === worst).sort((a, b) => a.id - b.id);
    const first = worstRuns[0];
    return [{
      worst,
      unmentioned: bad.filter((q) => badness(q) === 2).length,
      item: {
        id: first.id,
        promptId: first.prompt_id,
        question: first.question,
        topic: first.topic,
        platforms: PLATFORMS.filter((p) => worstRuns.some((q) => q.platform === p)),
        badRuns: bad.length,
        runs: runs.length,
      },
    }];
  });
  return ranked
    .sort((a, b) => b.worst - a.worst || b.unmentioned - a.unmentioned || b.item.badRuns - a.item.badRuns || a.item.id - b.item.id)
    .slice(0, limit)
    .map((r) => r.item);
}

export function computeSummary(questions: Question[], filter: SummaryFilter): SummaryDTO {
  const rows = applyFilter(questions, filter);
  const { brand, period } = loadBrand();
  const dates = rows.map((q) => q.date).sort();

  const byPlatform = groupBy(rows, (q) => q.platform);
  const platforms = PLATFORMS.filter((p) => byPlatform.has(p)).map((name) => ({
    name,
    ...metricRow(byPlatform.get(name)!),
  }));

  const trend = [...groupBy(rows, (q) => q.date).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, qs]) => {
      const m = metricRow(qs);
      return { date, visibility: m.visibility, mentions: m.mentions, recommendations: m.recommendations };
    });

  const topics = [...groupBy(rows, (q) => q.topic).entries()].map(([topic, qs]) => {
    const m = metricRow(qs);
    return { topic, questions: m.questions, visibility: m.visibility, recommendations: m.recommendations, scenario: topicScenario(topic) };
  });

  const byIntent = groupBy(rows, (q) => q.intent_type);
  const intents = [...byIntent.keys()].sort().map((intent) => {
    const m = metricRow(byIntent.get(intent)!);
    return { intent, questions: m.questions, visibility: m.visibility, recommendations: m.recommendations };
  });

  return {
    brand,
    period: dates.length ? `${dates[0]}~${dates[dates.length - 1]}` : period,
    kpi: metricRow(rows),
    prompts: promptCoverage(rows),
    platforms,
    trend,
    topics,
    intents,
    missingIntents: DOCUMENTED_INTENTS.filter((i) => !byIntent.has(i)),
    worstQuestions: promptsToFix(rows),
  };
}
