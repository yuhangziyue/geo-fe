/**
 * Test support for llm/*: the full-data LlmFacts, built the way http.ts will build them (buildActions →
 * factsForLlm), with the summary aggregates taken from truth.ts only — never from B1's runtime output.
 */
import { buildActions, factsForLlm } from '../../insight';
import { loadQuestions } from '../../repo';
import type { LlmFacts, SummaryV3DTO, TopicScenarioMap } from '../../schema';
import {
  TRUTH_FUNNEL,
  TRUTH_OWNED_SHARE,
  TRUTH_PERIOD,
  TRUTH_PLATFORMS,
  TRUTH_SOURCE_BACKED,
  TRUTH_SOURCE_TYPES,
  TRUTH_TOP_DOMAINS,
} from '../../__fixtures__/truth';

export const TEST_BRAND = 'AsterVision';

export const truthSummary: Pick<SummaryV3DTO, 'brand' | 'funnel' | 'periodHalves' | 'sources'> = {
  brand: TEST_BRAND,
  funnel: {
    questions: { value: TRUTH_FUNNEL.questions },
    mentions: { ...TRUTH_FUNNEL.mentions, deltaPt: TRUTH_PERIOD.deltaPt },
    recommendations: { ...TRUTH_FUNNEL.recommendations, deltaPt: null },
    sourceBacked: { cited: TRUTH_SOURCE_BACKED.cited, rateOfMentioned: TRUTH_SOURCE_BACKED.rateOfMentioned, deltaPt: null },
    ownedSource: { ...TRUTH_OWNED_SHARE, deltaPt: null },
  },
  periodHalves: {
    first: { from: TRUTH_PERIOD.first.from, to: TRUTH_PERIOD.first.to, n: TRUTH_PERIOD.first.n },
    last: { from: TRUTH_PERIOD.last.from, to: TRUTH_PERIOD.last.to, n: TRUTH_PERIOD.last.n },
  },
  sources: {
    byType: TRUTH_SOURCE_TYPES.map((t) => ({ ...t })),
    topDomains: TRUTH_TOP_DOMAINS.map((d) => ({ ...d })),
    ownedShare: { ...TRUTH_OWNED_SHARE },
    ownedByPlatform: TRUTH_PLATFORMS.filter((p) => p.ownedCitations > 0).map((p) => ({ platform: p.name, count: p.ownedCitations })),
  },
};

export function fullFacts(topicScenarios: TopicScenarioMap = new Map()): LlmFacts {
  return factsForLlm(buildActions(loadQuestions(), {}, topicScenarios), truthSummary);
}
