import type { LlmFacts, LlmSummaryResult } from '../schema';

/**
 * Deterministic summary built from `facts` — T0 stub, B2 implements.
 * Pure: never throws, no network; every number is copied from facts, so the result is always 100% verified.
 * Returns mode 'rules', model null, and `reason` as passed (why the AI path was not used, if it was asked for).
 * Used (1) when there is no ANTHROPIC_API_KEY and (2) as the fallback when the AI call fails.
 */
export function buildTemplateSummary(facts: LlmFacts, reason?: LlmSummaryResult['reason']): LlmSummaryResult {
  void facts;
  void reason;
  throw new Error('not implemented in T0');
}
