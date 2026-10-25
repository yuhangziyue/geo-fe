import { applyFilter, pct } from './metrics';
import { productSlugs } from './repo';
import {
  OWNED_DOMAIN,
  OWNED_DOMAIN_DISCLAIMER,
  PLATFORMS,
  compareActionCards,
  globalFilterHref,
  type ActionCard,
  type ActionTarget,
  type GlobalFilter,
  type Platform,
  type LlmFacts,
  type Question,
  type SummaryV3DTO,
  type TopicScenarioMap,
} from './schema';

/** 05 §3 trigger thresholds. A rule that does not cross its threshold produces no card — no padding. */
export const RULE_THRESHOLDS = {
  /** no-source-no-mention: ≥ 5 unmentioned answers, and ≥ 80% of them without any citation */
  noSourceMinUnmentioned: 5,
  noSourceMinSharePct: 80,
  /** visibility-declining: second half − first half ≤ −5 pt, both halves n ≥ 8 */
  declineMaxPt: -5,
  halfMinN: 8,
  /** weak-platform / weak-topic: the weakest is ≥ 10 pt below the selection overall */
  weakGapPt: 10,
  /** mention-not-recommended: ≥ 5 answers */
  notRecommendedMin: 5,
  /** owned-source-share: owned share < 25% with ≥ 10 citations */
  ownedMaxSharePct: 25,
  ownedMinCitations: 10,
} as const;

const T = RULE_THRESHOLDS;
const QUESTIONS_PATH = '/dashboard/questions';
const GENERIC_TARGET: ActionTarget = { kind: 'generic', label: 'View products', href: '/products' };

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Last day of the first half of the period, taken from the UNFILTERED rows so that every selection splits on the
 * same date (30 days → 08-01..08-15 | 08-16..08-30, as PeriodHalves). null when there is no row.
 */
function firstHalfEnd(all: Question[]): string | null {
  if (all.length === 0) return null;
  const dates = all.map((q) => q.date).sort();
  const days = Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / DAY_MS) + 1;
  return addDays(dates[0], Math.floor(days / 2) - 1);
}

/** Visibility per group; the weakest first (ties: the given key order). */
function weakest(rows: Question[], key: (q: Question) => string, order: (a: string, b: string) => number) {
  const groups = new Map<string, Question[]>();
  for (const q of rows) groups.set(key(q), [...(groups.get(key(q)) ?? []), q]);
  return [...groups.entries()]
    .map(([name, qs]) => ({ name, rows: qs, visibility: pct(qs.filter((q) => q.brand_mentioned).length, qs.length) }))
    .sort((a, b) => a.visibility - b.visibility || order(a.name, b.name))[0];
}

let slugCache: Map<string, string> | null = null;
function slugs(): Map<string, string> {
  if (!slugCache) {
    try {
      slugCache = productSlugs();
    } catch {
      slugCache = new Map();
    }
  }
  return slugCache;
}

/** Product-level target (05 §6 A′): the product named most in `rows` that has a Knowledge Center page. */
function productTarget(rows: Question[]): ActionTarget | null {
  const counts = new Map<string, number>();
  for (const q of rows) for (const p of q.mentioned_products) counts.set(p, (counts.get(p) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [name] of ranked) {
    const slug = slugs().get(name);
    // 05 §3: the product's admin edit page — that is where the content gets fixed
    if (slug) return { kind: 'product', label: `Edit ${name}`, href: `/admin/products/${slug}/edit` };
  }
  return null;
}

/** Topic → scenario; undefined (no mapping / file deleted) and null (deliberately none) both give null. */
function scenarioTarget(map: TopicScenarioMap, topic: string | undefined): ActionTarget | null {
  const ref = topic === undefined ? undefined : map.get(topic);
  return ref ? { kind: 'scenario', label: `Open ${ref.name} scenario`, href: `/scenarios/${ref.slug}` } : null;
}

/**
 * v3 action center (05 §3). Applies the global filter, then runs the 7 rules of RULE_IDS; a rule only produces a
 * card past its RULE_THRESHOLDS entry. Every number goes into `evidence` with its unit — finding / action text
 * never contains a digit. Targets are product-level first (05 §6 A′), then the topic's scenario, then /products;
 * `topicScenarios` may be an EMPTY map (topic-scenario.json deleted) and that only drops the scenario links.
 * Sorted with compareActionCards.
 */
export function buildActions(questions: Question[], filter: GlobalFilter, topicScenarios: TopicScenarioMap): ActionCard[] {
  const rows = applyFilter(questions, filter);
  if (rows.length === 0) return [];
  const href = (extra: Record<string, string>) => globalFilterHref(QUESTIONS_PATH, filter, extra);
  const overall = pct(rows.filter((q) => q.brand_mentioned).length, rows.length);
  const notMentioned = rows.filter((q) => !q.brand_mentioned);
  const mentioned = rows.filter((q) => q.brand_mentioned);
  const weakTopic = weakest(rows, (q) => q.topic, (a, b) => a.localeCompare(b));
  const cards: ActionCard[] = [];

  // no-source-no-mention — F3: they occur together; worded as co-occurrence, not cause
  const noCitation = notMentioned.filter((q) => q.citations.length === 0);
  if (notMentioned.length >= T.noSourceMinUnmentioned && noCitation.length * 100 >= T.noSourceMinSharePct * notMentioned.length) {
    const cited = rows.filter((q) => q.citations.length > 0);
    cards.push({
      id: 'no-source-no-mention',
      severity: 'high',
      affectedQuestions: noCitation.length,
      finding: 'Answers that leave the brand out cite no sources',
      evidence: [
        { label: 'Unmentioned answers with no citation', value: noCitation.length, unit: 'count', of: notMentioned.length },
        ...(cited.length > 0
          ? [{ label: 'Cited answers that mention the brand', value: cited.filter((q) => q.brand_mentioned).length, unit: 'count' as const, of: cited.length }]
          : []),
      ],
      action: 'Publish citable pages (specs, comparisons, how-tos) for the questions where the brand is missing.',
      evidenceHref: href({ mentioned: 'false' }),
      target: productTarget(notMentioned) ?? scenarioTarget(topicScenarios, weakTopic.name) ?? GENERIC_TARGET,
      disclaimer: OWNED_DOMAIN_DISCLAIMER,
    });
  }

  // visibility-declining — second half vs first half of the period (F5)
  const split = firstHalfEnd(questions);
  if (split) {
    const first = rows.filter((q) => q.date <= split);
    const last = rows.filter((q) => q.date > split);
    if (first.length >= T.halfMinN && last.length >= T.halfMinN) {
      const firstPct = pct(first.filter((q) => q.brand_mentioned).length, first.length);
      const lastPct = pct(last.filter((q) => q.brand_mentioned).length, last.length);
      const delta = lastPct - firstPct;
      if (delta <= T.declineMaxPt) {
        cards.push({
          id: 'visibility-declining',
          severity: 'high',
          affectedQuestions: last.filter((q) => !q.brand_mentioned).length,
          finding: 'Visibility is declining',
          evidence: [
            { label: 'First half', value: firstPct, unit: 'pct' },
            { label: 'Second half', value: lastPct, unit: 'pct' },
            { label: 'Change', value: delta, unit: 'pt' },
          ],
          action: 'Review the recent answers that dropped the brand and refresh the pages they draw on.',
          evidenceHref: href({ mentioned: 'false' }),
          target: null,
        });
      }
    }
  }

  // weak-platform — compared with the selection overall
  const order = (a: string, b: string) => PLATFORMS.indexOf(a as Platform) - PLATFORMS.indexOf(b as Platform);
  const weakPlatform = weakest(rows, (q) => q.platform, order);
  if (overall - weakPlatform.visibility >= T.weakGapPt) {
    cards.push({
      id: 'weak-platform',
      severity: 'high',
      affectedQuestions: weakPlatform.rows.filter((q) => !q.brand_mentioned).length,
      finding: `${weakPlatform.name} mentions the brand least`,
      evidence: [
        { label: weakPlatform.name, value: weakPlatform.visibility, unit: 'pct' },
        { label: 'All platforms', value: overall, unit: 'pct' },
        { label: 'Gap', value: weakPlatform.visibility - overall, unit: 'pt' },
      ],
      action: `Check which sources ${weakPlatform.name} cites for these questions and get the brand onto them.`,
      evidenceHref: href({ platform: weakPlatform.name, mentioned: 'false' }),
      target: null,
    });
  }

  // mention-not-recommended
  const notRecommended = mentioned.filter((q) => !q.brand_recommended);
  if (notRecommended.length >= T.notRecommendedMin) {
    cards.push({
      id: 'mention-not-recommended',
      severity: 'medium',
      affectedQuestions: notRecommended.length,
      finding: 'Mentions are not turning into recommendations',
      evidence: [
        { label: 'Mentioned, not recommended', value: notRecommended.length, unit: 'count', of: mentioned.length },
        { label: 'Recommended when mentioned', value: pct(mentioned.length - notRecommended.length, mentioned.length), unit: 'pct' },
      ],
      action: 'Strengthen the product pages these answers name: specs, proof points and a clear fit.',
      evidenceHref: href({ mentioned: 'true', recommended: 'false' }),
      target: productTarget(notRecommended) ?? GENERIC_TARGET,
    });
  }

  // weak-topic — compared with the selection overall
  if (overall - weakTopic.visibility >= T.weakGapPt) {
    cards.push({
      id: 'weak-topic',
      severity: 'medium',
      affectedQuestions: weakTopic.rows.filter((q) => !q.brand_mentioned).length,
      finding: `${weakTopic.name} is the weakest topic`,
      evidence: [
        { label: weakTopic.name, value: weakTopic.visibility, unit: 'pct' },
        { label: 'All topics', value: overall, unit: 'pct' },
        { label: 'Gap', value: weakTopic.visibility - overall, unit: 'pt' },
      ],
      action: 'Add content that answers these questions on the page that covers this topic.',
      evidenceHref: href({ topic: weakTopic.name, mentioned: 'false' }),
      target: scenarioTarget(topicScenarios, weakTopic.name) ?? GENERIC_TARGET,
    });
  }

  // owned-source-share — owned is decided by domain only (F4), and that domain is an assumption (F9)
  const totalCitations = rows.reduce((n, q) => n + q.citations.length, 0);
  const owned = rows.reduce((n, q) => n + q.citations.filter((c) => isOwnedUrl(c.url)).length, 0);
  if (totalCitations >= T.ownedMinCitations && owned * 100 < T.ownedMaxSharePct * totalCitations) {
    cards.push({
      id: 'owned-source-share',
      severity: 'medium',
      affectedQuestions: rows.filter((q) => q.citations.length > 0 && !q.citations.some((c) => isOwnedUrl(c.url))).length,
      finding: 'Few citations point to owned pages',
      evidence: [
        { label: 'Owned citations', value: owned, unit: 'count', of: totalCitations },
        { label: 'Owned share', value: pct(owned, totalCitations), unit: 'pct' },
      ],
      action: 'Publish structured first-party pages that AI answers can cite.',
      evidenceHref: href({ q: OWNED_DOMAIN }),
      target: GENERIC_TARGET,
      disclaimer: OWNED_DOMAIN_DISCLAIMER,
    });
  }

  // decision-tier-untracked — only meaningful without an intent filter (with one, S is filtered out, not untracked)
  const decision = rows.filter((q) => q.intent_type === 'S');
  if (!filter.intent && decision.length === 0) {
    cards.push({
      id: 'decision-tier-untracked',
      severity: 'low',
      affectedQuestions: decision.length,
      finding: 'No decision-stage questions are monitored',
      evidence: [
        { label: 'Decision-stage questions', value: decision.length, unit: 'count' },
        { label: 'Questions monitored', value: rows.length, unit: 'count' },
      ],
      action: 'Add pricing, purchase and channel questions to the monitored set.',
      evidenceHref: href({ intent: 'S' }),
      target: null,
    });
  }

  return cards.sort(compareActionCards);
}

/**
 * The fact sheet handed to the LLM / template summary: built only from the cards and the summary aggregates,
 * never from raw rows. Cards are re-sorted (compareActionCards) before the first 5 are taken.
 */
export function factsForLlm(
  cards: ActionCard[],
  summary: Pick<SummaryV3DTO, 'brand' | 'funnel' | 'periodHalves' | 'sources'>,
): LlmFacts {
  const { funnel, periodHalves, sources } = summary;
  return {
    brand: summary.brand,
    period: { from: periodHalves.first.from, to: periodHalves.last.to },
    funnel: {
      questions: funnel.questions.value,
      mentions: funnel.mentions.value,
      mentionRateOfAsked: funnel.mentions.rateOfAsked,
      recommendations: funnel.recommendations.value,
      recommendRateOfAsked: funnel.recommendations.rateOfAsked,
      recommendRateOfMentioned: funnel.recommendations.rateOfPrevious,
    },
    delta: { mentionRateOfAskedPt: funnel.mentions.deltaPt, firstN: periodHalves.first.n, lastN: periodHalves.last.n },
    sources: { ownedShareOfCitations: sources.ownedShare.shareOfCitations, totalCitations: sources.ownedShare.totalCitations },
    topFindings: [...cards]
      .sort(compareActionCards)
      .slice(0, 5)
      .map((c) => ({ severity: c.severity, finding: c.finding, evidence: c.evidence })),
  };
}

export const isOwnedUrl = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host === OWNED_DOMAIN || host.endsWith(`.${OWNED_DOMAIN}`);
  } catch {
    return false;
  }
};
