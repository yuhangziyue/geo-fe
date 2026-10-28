import { applyFilter, pct } from '../metrics';
import { PLATFORMS } from '../schema';
import type { AttributionDTO, AttributionRow, AttributionShift, AttributionVerdict, GlobalFilter, HalfBucket, PlatformTrends, Question, TrendPoint } from '../schema';
import { buildTrend, PLATFORM_MIN_WINDOW_N, PLATFORM_WINDOW_DAYS } from './trend';
import { MIN_HALF_N, inHalf, periodDays, periodHalves } from './period';

/**
 * Attribution block (docs/dashboard-design-optimization-v1.md §3): half-to-half visibility deltas per platform and
 * intent tier, the 100 % stacked mention-share migration bars, and the A / C 7-day sub trends.
 *
 * 计算口径:
 * - 半程 = periodHalves 的 first/last（沿用现有聚合，from/to 以全量数据为轴）;
 * - 每维度的 rows = applyFilter(当前筛选 + 该维度值)，即从全量数据出发叠加当前全局筛选;
 * - 每行一个平台或意图 tier；verdict：任一半程 n < MIN_HALF_N → 'too_few_samples'；否则
 *   deltaPt = second.visibility − first.visibility，|deltaPt| >= 1/min(first.n, second.n) × 100 → 'signal'，否则 'within_error';
 * - shift：firstMentions / secondMentions = 该维度行中 brand_mentioned 的半程计数（100 % 堆叠迁移图的原始份额）;
 * - intentTrends：对 intent A 与 C，buildTrend(applyFilter(全量, {…当前筛选, intent}), periodDays(全量))。
 */

/** 一个半程桶：n = 半程问题数，visibility = 半程提及率（pct）。 */
function halfBucket(rows: Question[], h: { from: string; to: string }): HalfBucket {
  const half = inHalf(rows, h);
  return {
    from: h.from,
    to: h.to,
    n: half.length,
    visibility: pct(half.filter((q) => q.brand_mentioned).length, half.length),
  };
}

/** 信号判定（见文件头注释）。 */
function verdictOf(first: HalfBucket, second: HalfBucket): { deltaPt: number | null; verdict: AttributionVerdict } {
  if (first.n < MIN_HALF_N || second.n < MIN_HALF_N) return { deltaPt: null, verdict: 'too_few_samples' };
  const deltaPt = second.visibility - first.visibility;
  const oneRowPt = (1 / Math.min(first.n, second.n)) * 100;
  return { deltaPt, verdict: Math.abs(deltaPt) >= oneRowPt ? 'signal' : 'within_error' };
}

/** 每一行的 rows：当前筛选 + 该维度值（platform / intent 由 filterKey 指定，其余筛选原样携带）。 */
function dimensionRows(
  questions: Question[],
  filter: GlobalFilter,
  keys: ReadonlyArray<string>,
  filterKey: 'platform' | 'intent',
): AttributionRow[] {
  const days = periodDays(questions);
  const halves = periodHalves([], days);
  return keys.map((key) => {
    const rows = applyFilter(questions, { ...filter, [filterKey]: key });
    const first = halfBucket(rows, halves.first);
    const second = halfBucket(rows, halves.last);
    const { deltaPt, verdict } = verdictOf(first, second);
    return { key, label: key, first, second, deltaPt, verdict };
  });
}

/** 100 % 堆叠迁移图的数据：每个维度值一个 label，带前半 / 后半的 brand_mentioned 计数。 */
function shiftRows(
  questions: Question[],
  filter: GlobalFilter,
  keys: ReadonlyArray<string>,
  filterKey: 'platform' | 'intent',
): AttributionShift[] {
  const days = periodDays(questions);
  const halves = periodHalves([], days);
  return keys.map((key) => {
    const rows = applyFilter(questions, { ...filter, [filterKey]: key });
    return {
      label: key,
      firstMentions: inHalf(rows, halves.first).filter((q) => q.brand_mentioned).length,
      secondMentions: inHalf(rows, halves.last).filter((q) => q.brand_mentioned).length,
    };
  });
}

/** byPlatform 按 PLATFORMS 顺序各一行；byIntent 按 A、B、C、S 各一行（S 自然算出 n=0 → too_few_samples）。 */
export function buildAttribution(questions: Question[], filter: GlobalFilter): AttributionDTO {
  return {
    byPlatform: { rows: dimensionRows(questions, filter, PLATFORMS, 'platform'), shift: shiftRows(questions, filter, PLATFORMS, 'platform') },
    byIntent: { rows: dimensionRows(questions, filter, ['A', 'B', 'C', 'S'], 'intent'), shift: shiftRows(questions, filter, ['A', 'B', 'C', 'S'], 'intent') },
  };
}

/** Intent A / C 7-day rolling trends under the current filter; the x-axis stays the FULL period's days. */
export function buildIntentTrends(questions: Question[], filter: GlobalFilter): { A: TrendPoint[]; C: TrendPoint[] } {
  const days = periodDays(questions);
  return {
    A: buildTrend(applyFilter(questions, { ...filter, intent: 'A' }), days),
    C: buildTrend(applyFilter(questions, { ...filter, intent: 'C' }), days),
  };
}

/**
 * Per-platform 14-day rolling trends for the small multiples (P1, docs/dashboard-design-optimization-v1.md §3).
 * Each platform keeps the FULL period axis (n≈11 per full window on this dataset), and a window is drawn only
 * when it holds ≥ PLATFORM_MIN_WINDOW_N questions — filtered windows below the gate stay null ("no fabricated
 * lines"). Rows per platform = current filter + that platform, mirroring buildIntentTrends.
 */
export function buildPlatformTrends(questions: Question[], filter: GlobalFilter): PlatformTrends {
  const days = periodDays(questions);
  return Object.fromEntries(
    PLATFORMS.map((p) => [
      p,
      buildTrend(applyFilter(questions, { ...filter, platform: p }), days, PLATFORM_WINDOW_DAYS, PLATFORM_MIN_WINDOW_N),
    ]),
  ) as PlatformTrends;
}
