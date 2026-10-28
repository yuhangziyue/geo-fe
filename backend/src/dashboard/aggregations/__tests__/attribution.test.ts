import { describe, expect, it } from 'vitest';
import { TRUTH_INTENTS, TRUTH_PERIOD, TRUTH_PLATFORMS, TRUTH_TREND } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { PLATFORMS, type AttributionVerdict } from '../../schema';
import { buildAttribution, buildIntentTrends, buildPlatformTrends } from '../attribution';
import { periodDays } from '../period';

const questions = loadQuestions();

/** 独立重算 verdict（与实现同规则但单独推导），断言计算值一致。 */
function expectedVerdict(first: { n: number }, second: { n: number }, deltaPt: number | null): AttributionVerdict {
  if (first.n < 8 || second.n < 8) return 'too_few_samples';
  const oneRowPt = (1 / Math.min(first.n, second.n)) * 100;
  return Math.abs(deltaPt ?? 0) >= oneRowPt ? 'signal' : 'within_error';
}

describe('buildAttribution', () => {
  const a = buildAttribution(questions, {});

  it('byPlatform: one row per platform, in PLATFORMS order, each half ≥ 8 → real deltas', () => {
    expect(a.byPlatform.rows.map((r) => r.key)).toEqual([...PLATFORMS]);
    for (const row of a.byPlatform.rows) {
      expect(row.label).toBe(row.key);
      expect(row.first.n + row.second.n).toBe(TRUTH_PLATFORMS.find((p) => p.name === row.key)!.n);
      expect(row.first.n).toBeGreaterThanOrEqual(8);
      expect(row.second.n).toBeGreaterThanOrEqual(8);
      expect(row.deltaPt).not.toBeNull();
      expect(row.verdict).toBe(expectedVerdict(row.first, row.second, row.deltaPt));
    }
  });

  it('DeepSeek: 24 rows → half n averages 12, and the drop is a signal', () => {
    const deepseek = a.byPlatform.rows.find((r) => r.key === 'DeepSeek')!;
    // 半程 n=12 口径：两个半程的平均样本数 = 24 / 2；数据上实际是 11 / 13。
    expect((deepseek.first.n + deepseek.second.n) / 2).toBe(12);
    expect(deepseek.verdict).toBe('signal');
    expect(deepseek.deltaPt).toBeLessThan(0);
  });

  it('byIntent: A, B, C, S rows; A has exactly 30 questions per half', () => {
    expect(a.byIntent.rows.map((r) => r.key)).toEqual(['A', 'B', 'C', 'S']);
    const aRow = a.byIntent.rows.find((r) => r.key === 'A')!;
    expect(aRow.first.n).toBe(TRUTH_INTENTS.find((t) => t.tier === 'A')!.questions / 2);
    expect(aRow.second.n).toBe(TRUTH_INTENTS.find((t) => t.tier === 'A')!.questions / 2);
    expect(aRow.verdict).toBe('signal');
    for (const row of a.byIntent.rows) {
      expect(row.verdict).toBe(expectedVerdict(row.first, row.second, row.deltaPt));
    }
  });

  it('S row: n=0 in both halves, no delta, too_few_samples', () => {
    const s = a.byIntent.rows.find((r) => r.key === 'S')!;
    expect(s.first).toEqual({ from: TRUTH_PERIOD.first.from, to: TRUTH_PERIOD.first.to, n: 0, visibility: 0 });
    expect(s.second).toEqual({ from: TRUTH_PERIOD.last.from, to: TRUTH_PERIOD.last.to, n: 0, visibility: 0 });
    expect(s.deltaPt).toBeNull();
    expect(s.verdict).toBe('too_few_samples');
  });

  it('B row: second half drops below 8 → too_few_samples with no delta', () => {
    const b = a.byIntent.rows.find((r) => r.key === 'B')!;
    expect(b.verdict).toBe('too_few_samples');
    expect(b.deltaPt).toBeNull();
  });

  it('shift: per-half mention counts sum to the period totals (100 % stacked baseline)', () => {
    const byPlatformFirst = a.byPlatform.shift.reduce((n, s) => n + s.firstMentions, 0);
    const byPlatformSecond = a.byPlatform.shift.reduce((n, s) => n + s.secondMentions, 0);
    expect(byPlatformFirst).toBe(TRUTH_PERIOD.first.mentions);
    expect(byPlatformSecond).toBe(TRUTH_PERIOD.last.mentions);
    const byIntentFirst = a.byIntent.shift.reduce((n, s) => n + s.firstMentions, 0);
    const byIntentSecond = a.byIntent.shift.reduce((n, s) => n + s.secondMentions, 0);
    expect(byIntentFirst).toBe(TRUTH_PERIOD.first.mentions);
    expect(byIntentSecond).toBe(TRUTH_PERIOD.last.mentions);
    expect(a.byPlatform.shift.map((s) => s.label)).toEqual([...PLATFORMS]);
    expect(a.byIntent.shift.map((s) => s.label)).toEqual(['A', 'B', 'C', 'S']);
  });

  it('a global filter stacks with the dimension value (intent A narrows every platform row)', () => {
    const d = buildAttribution(questions, { intent: 'A' });
    // 每一行 = 当前筛选(intent=A) + 该平台值；五行之和 = 全部 A 行。
    expect(d.byPlatform.rows.reduce((n, r) => n + r.first.n + r.second.n, 0)).toBe(TRUTH_INTENTS.find((t) => t.tier === 'A')!.questions);
    // 100 % 堆叠基线随筛选迁移：平台 shift 各半程之和 = 意图 A 的半程提及数。
    expect(d.byPlatform.shift.reduce((n, s) => n + s.firstMentions, 0)).toBe(22);
    expect(d.byPlatform.shift.reduce((n, s) => n + s.secondMentions, 0)).toBe(17);
  });
});

describe('buildIntentTrends', () => {
  it('A and C keep the full 30-day axis under the current filter', () => {
    const t = buildIntentTrends(questions, {});
    expect(t.A).toHaveLength(TRUTH_TREND.days);
    expect(t.C).toHaveLength(TRUTH_TREND.days);
    // A 的滚动窗口样本数 = 60 行 / 30 天 × 7 天窗口 = 14（全量 7 日窗口）。
    const aLast = t.A[t.A.length - 1];
    expect(aLast.rollingN).toBe(14);
    expect(aLast.rollingVisibility).not.toBeNull();
  });
});

// P1 (docs/dashboard-design-optimization-v1.md §3): per-platform 14-day rolling windows for the small multiples;
// every platform has ~24 rows over 30 days, so a full window holds n≈11 — above the n ≥ 8 line gate everywhere.
describe('buildPlatformTrends', () => {
  const days = periodDays(questions);
  const trends = buildPlatformTrends(questions, {});
  const last14 = { from: days[days.length - 14], to: days[days.length - 1] };

  it('one series per platform in PLATFORMS order, each keeping the full 30-day axis', () => {
    expect(Object.keys(trends)).toEqual([...PLATFORMS]);
    for (const p of PLATFORMS) expect(trends[p]).toHaveLength(TRUTH_TREND.days);
  });

  it('draws nothing before the 14-day window is full, then a gated line with independently counted n', () => {
    for (const p of PLATFORMS) {
      for (const point of trends[p].slice(0, 13)) expect(point.rollingVisibility).toBeNull();
      const last = trends[p][trends[p].length - 1];
      const n = questions.filter((q) => q.platform === p && q.date >= last14.from && q.date <= last14.to).length;
      expect(n).toBeGreaterThanOrEqual(8); // n≈11 on this dataset; the gate must not erase an unfiltered line
      expect(last.rollingN).toBe(n);
      expect(last.rollingVisibility).not.toBeNull();
    }
  });

  it('stacks with the current filter and hides the line when a filtered window drops below n = 8', () => {
    const t = buildPlatformTrends(questions, { intent: 'A' });
    const last = t.DeepSeek[t.DeepSeek.length - 1];
    const n = questions.filter(
      (q) => q.platform === 'DeepSeek' && q.intent_type === 'A' && q.date >= last14.from && q.date <= last14.to,
    ).length;
    expect(last.rollingN).toBe(n);
    if (n >= 8) expect(last.rollingVisibility).not.toBeNull();
    else expect(last.rollingVisibility).toBeNull();
  });
});
