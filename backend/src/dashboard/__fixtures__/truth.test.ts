import { describe, expect, it } from 'vitest';
import { pct } from '../metrics';
import { loadQuestions } from '../repo';
import { OWNED_DOMAIN, PLATFORMS, RULE_IDS, type Question } from '../schema';
import {
  TRUTH_ACTION_CARDS,
  TRUTH_DATA_SHAPE,
  TRUTH_F3_F6,
  TRUTH_FUNNEL,
  TRUTH_INTENTS,
  TRUTH_MATRIX,
  TRUTH_OWNED_SHARE,
  TRUTH_PCT_VALUES,
  TRUTH_PERIOD,
  TRUTH_PLATFORMS,
  TRUTH_PT_VALUES,
  TRUTH_SOURCE_BACKED,
  TRUTH_SOURCE_TYPES,
  TRUTH_TOP_DOMAINS,
  TRUTH_TOPICS,
  TRUTH_TREND,
} from './truth';

/*
 * Guards the truth table itself: every constant in truth.ts is recomputed here from questions.json with plain,
 * independent code (no v3 aggregation is used), so a typo in the table — or drift in the data — turns this red
 * before any downstream test starts asserting against a wrong number.
 */
const all = loadQuestions();
const isOwned = (url: string) => {
  const host = new URL(url).hostname;
  return host === OWNED_DOMAIN || host.endsWith(`.${OWNED_DOMAIN}`);
};
const count = (rows: Question[], f: (q: Question) => boolean) => rows.filter(f).length;
const mentioned = (q: Question) => q.brand_mentioned;
const recommended = (q: Question) => q.brand_recommended;
const cited = (q: Question) => q.citations.length > 0;
const tally = <K>(keys: K[]) => {
  const m = new Map<K, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
};

describe('truth table matches questions.json', () => {
  it('funnel', () => {
    const m = count(all, mentioned);
    const r = count(all, recommended);
    expect({
      questions: all.length,
      mentions: { value: m, rateOfAsked: pct(m, all.length), rateOfPrevious: pct(m, all.length) },
      recommendations: { value: r, rateOfAsked: pct(r, all.length), rateOfPrevious: pct(r, m) },
    }).toEqual(TRUTH_FUNNEL);
  });

  it('source-backed and owned share', () => {
    const c = count(all, cited);
    expect({ cited: c, mentions: count(all, mentioned), rateOfMentioned: pct(c, count(all, mentioned)) }).toEqual(
      TRUTH_SOURCE_BACKED,
    );
    const urls = all.flatMap((q) => q.citations.map((x) => x.url));
    const owned = urls.filter(isOwned).length;
    expect({ owned, totalCitations: urls.length, shareOfCitations: pct(owned, urls.length) }).toEqual(TRUTH_OWNED_SHARE);
  });

  it('platforms', () => {
    for (const t of TRUTH_PLATFORMS) {
      const rows = all.filter((q) => q.platform === t.name);
      const m = count(rows, mentioned);
      expect({
        name: t.name,
        n: rows.length,
        mentions: m,
        recommendations: count(rows, recommended),
        cited: count(rows, cited),
        visibility: pct(m, rows.length),
        recommendationRateOfAsked: pct(count(rows, recommended), rows.length),
        sourceBackedRateOfMentioned: pct(count(rows, cited), m),
        ownedCitations: rows.flatMap((q) => q.citations).filter((c) => isOwned(c.url)).length,
        isWorst: t.isWorst,
      }).toEqual(t);
    }
    expect(TRUTH_PLATFORMS.map((p) => p.name)).toEqual([...PLATFORMS]);
    const worst = [...TRUTH_PLATFORMS].sort((a, b) => a.visibility - b.visibility)[0];
    expect(TRUTH_PLATFORMS.filter((p) => p.isWorst)).toEqual([worst]);
  });

  it('period halves and delta', () => {
    for (const half of [TRUTH_PERIOD.first, TRUTH_PERIOD.last]) {
      const rows = all.filter((q) => q.date >= half.from && q.date <= half.to);
      expect({ ...half, n: rows.length, mentions: count(rows, mentioned), pct: pct(count(rows, mentioned), rows.length) }).toEqual(half);
    }
    expect(TRUTH_PERIOD.last.pct - TRUTH_PERIOD.first.pct).toBe(TRUTH_PERIOD.deltaPt);
  });

  it('trend: daily samples and 7-day rolling windows', () => {
    const perDay = tally(all.map((q) => q.date));
    expect(perDay.size).toBe(TRUTH_TREND.days);
    expect(new Set(perDay.values())).toEqual(new Set([TRUTH_TREND.dailyN]));
    for (const w of TRUTH_TREND.rolling) {
      const rows = all.filter((q) => q.date >= w.from && q.date <= w.date);
      expect({ ...w, n: rows.length, mentions: count(rows, mentioned), pct: pct(count(rows, mentioned), rows.length) }).toEqual(w);
    }
    for (const d of TRUTH_TREND.daily) {
      const rows = all.filter((q) => q.date === d.date);
      expect({ ...d, n: rows.length, mentions: count(rows, mentioned), pct: pct(count(rows, mentioned), rows.length) }).toEqual(d);
    }
  });

  it('intent tiers', () => {
    for (const t of TRUTH_INTENTS) {
      const rows = all.filter((q) => q.intent_type === t.tier);
      expect({
        tier: t.tier,
        questions: rows.length,
        mentions: count(rows, mentioned),
        recommendations: count(rows, recommended),
        visibility: pct(count(rows, mentioned), rows.length),
        recommendationRateOfAsked: pct(count(rows, recommended), rows.length),
      }).toEqual(t);
    }
  });

  it('topics', () => {
    const topics = [...new Set(all.map((q) => q.topic))].sort();
    expect(TRUTH_TOPICS.map((t) => t.topic).sort()).toEqual(topics);
    for (const t of TRUTH_TOPICS) {
      const rows = all.filter((q) => q.topic === t.topic);
      expect({ ...t, questions: rows.length, mentions: count(rows, mentioned), visibility: pct(count(rows, mentioned), rows.length) }).toEqual(t);
    }
    const weakest = TRUTH_TOPICS.filter((t) => t.isWorst);
    expect(weakest).toHaveLength(1);
    expect(Math.min(...TRUTH_TOPICS.map((t) => t.visibility))).toBe(weakest[0].visibility);
  });

  it('source types and top domains', () => {
    const types = tally(all.flatMap((q) => q.citations.map((c) => c.source_type)));
    expect(TRUTH_SOURCE_TYPES.map((t) => [t.type, t.count])).toEqual([...types.entries()].sort((a, b) => b[1] - a[1]));
    const domains = tally(all.flatMap((q) => q.citations.map((c) => new URL(c.url).hostname)));
    for (const d of TRUTH_TOP_DOMAINS) {
      expect(domains.get(d.domain)).toBe(d.count);
      expect(d.owned).toBe(d.domain === OWNED_DOMAIN);
    }
    const listed = new Set<string>(TRUTH_TOP_DOMAINS.map((d) => d.domain));
    const floor = Math.min(...TRUTH_TOP_DOMAINS.map((d) => d.count));
    for (const [domain, n] of domains) if (!listed.has(domain)) expect(n).toBeLessThan(floor);
  });

  it('data shape: prompts, runs, cells', () => {
    const byPrompt = new Map<string, Question[]>();
    for (const q of all) byPrompt.set(q.question, [...(byPrompt.get(q.question) ?? []), q]);
    expect(byPrompt.size).toBe(TRUTH_DATA_SHAPE.distinctQuestions);
    expect(Object.fromEntries(tally([...byPrompt.values()].map((r) => r.length)))).toEqual(TRUTH_DATA_SHAPE.runsPerQuestion);
    expect(Object.fromEntries(tally([...byPrompt.values()].map((r) => new Set(r.map((q) => q.platform)).size)))).toEqual(
      TRUTH_DATA_SHAPE.platformsPerQuestion,
    );
    const cells = tally(all.map((q) => `${q.question}\u0000${q.platform}`));
    expect(cells.size).toBe(TRUTH_MATRIX.trackedCells);
    expect(Object.fromEntries(tally([...cells.values()]))).toEqual(TRUTH_MATRIX.runsPerCell);
  });

  it('matrix: five states and gap scores', () => {
    const counts = { recommended: 0, partly: 0, mentioned_only: 0, not_mentioned: 0, not_tracked: 0 };
    const gaps: Array<{ question: string; gap: number }> = [];
    for (const question of new Set(all.map((q) => q.question))) {
      let gap = 0;
      for (const p of PLATFORMS) {
        const runs = all.filter((q) => q.question === question && q.platform === p);
        const r = count(runs, recommended);
        const m = count(runs, mentioned);
        if (runs.length === 0) counts.not_tracked++;
        else if (r === runs.length) counts.recommended++;
        else if (r > 0) counts.partly++;
        else if (m > 0) {
          counts.mentioned_only++;
          gap += 1;
        } else {
          counts.not_mentioned++;
          gap += 2;
        }
      }
      gaps.push({ question, gap });
    }
    expect(counts).toEqual(TRUTH_MATRIX.stateCounts);
    gaps.sort((a, b) => b.gap - a.gap || a.question.localeCompare(b.question));
    expect(gaps.slice(0, TRUTH_MATRIX.defaultRows).map((g) => g.gap)).toEqual(TRUTH_MATRIX.top12GapScores);
  });

  it('F3 / F6 cross-facts', () => {
    const notMentioned = all.filter((q) => !q.brand_mentioned);
    const citedRows = all.filter(cited);
    const rec = all.filter(recommended);
    expect({
      notMentioned: notMentioned.length,
      notMentionedWithoutCitations: count(notMentioned, (q) => !cited(q)),
      citedQuestions: citedRows.length,
      citedAndMentioned: count(citedRows, mentioned),
      recommendedWithoutCitations: count(rec, (q) => !cited(q)),
      citedNotRecommended: count(citedRows, (q) => !q.brand_recommended),
      mentionedNotRecommended: count(all, (q) => q.brand_mentioned && !q.brand_recommended),
      recommendedWithoutOwned: count(rec, (q) => !q.citations.some((c) => isOwned(c.url))),
    }).toEqual(TRUTH_F3_F6);
  });

  it('action cards: affectedQuestions per the RuleId definitions in schema.ts', () => {
    const notMentioned = all.filter((q) => !q.brand_mentioned);
    const weakestPlatform = TRUTH_PLATFORMS.find((p) => p.isWorst)!.name;
    const weakestTopic = TRUTH_TOPICS.find((t) => t.isWorst)!.topic;
    const affected: Record<string, number> = {
      'no-source-no-mention': count(notMentioned, (q) => !cited(q)),
      'visibility-declining': count(notMentioned, (q) => q.date >= TRUTH_PERIOD.last.from && q.date <= TRUTH_PERIOD.last.to),
      'weak-platform': count(notMentioned, (q) => q.platform === weakestPlatform),
      'mention-not-recommended': count(all, (q) => q.brand_mentioned && !q.brand_recommended),
      'weak-topic': count(notMentioned, (q) => q.topic === weakestTopic),
      'owned-source-share': count(all, (q) => cited(q) && !q.citations.some((c) => isOwned(c.url))),
      'decision-tier-untracked': count(all, (q) => q.intent_type === 'S'),
    };
    expect(Object.fromEntries(TRUTH_ACTION_CARDS.map((c) => [c.id, c.affectedQuestions]))).toEqual(affected);
  });

  it('action cards: ordered by severity, then affectedQuestions desc, then RULE_IDS order', () => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const sorted = [...TRUTH_ACTION_CARDS].sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        b.affectedQuestions - a.affectedQuestions ||
        RULE_IDS.indexOf(a.id) - RULE_IDS.indexOf(b.id),
    );
    expect(TRUTH_ACTION_CARDS).toEqual(sorted);
    expect(new Set(TRUTH_ACTION_CARDS.map((c) => c.id))).toEqual(new Set(RULE_IDS));
  });

  it('TRUTH_PCT_VALUES is the de-duplicated set of every %-truth above', () => {
    const expected = new Set<number>([
      TRUTH_FUNNEL.mentions.rateOfAsked,
      TRUTH_FUNNEL.mentions.rateOfPrevious,
      TRUTH_FUNNEL.recommendations.rateOfAsked,
      TRUTH_FUNNEL.recommendations.rateOfPrevious,
      TRUTH_SOURCE_BACKED.rateOfMentioned,
      TRUTH_OWNED_SHARE.shareOfCitations,
      ...TRUTH_PLATFORMS.flatMap((p) => [p.visibility, p.recommendationRateOfAsked, p.sourceBackedRateOfMentioned]),
      TRUTH_PERIOD.first.pct,
      TRUTH_PERIOD.last.pct,
      ...TRUTH_TREND.rolling.map((w) => w.pct),
      ...TRUTH_INTENTS.filter((t) => t.questions > 0).flatMap((t) => [t.visibility, t.recommendationRateOfAsked]),
      ...TRUTH_TOPICS.map((t) => t.visibility),
    ]);
    expect([...TRUTH_PCT_VALUES].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
    expect(TRUTH_PT_VALUES).toEqual([TRUTH_PERIOD.deltaPt]);
  });
});
