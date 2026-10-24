import { loadBrand } from './repo';
import { PLATFORMS, type MetricRow, type Question, type SummaryDTO, type SummaryFilter } from './schema';

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
    return { topic, questions: m.questions, visibility: m.visibility, recommendations: m.recommendations };
  });

  const worstQuestions = rows
    .filter((q) => badness(q) > 0)
    .sort((a, b) => badness(b) - badness(a) || a.id - b.id)
    .slice(0, 5)
    .map(({ id, question, platform, topic }) => ({ id, question, platform, topic }));

  return {
    brand,
    period: dates.length ? `${dates[0]}~${dates[dates.length - 1]}` : period,
    kpi: metricRow(rows),
    platforms,
    trend,
    topics,
    worstQuestions,
  };
}
