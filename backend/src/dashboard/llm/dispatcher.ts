import type { LlmFacts, LlmSummaryResult, SummaryMode } from '../schema';

/** LLM_PROVIDER values; unset = 'anthropic'. Any other value falls back to the template summary. */
export type LlmProvider = 'anthropic' | 'mock';

/**
 * The single entry point for POST /api/dashboard/action-center/summary — T0 stub, B2 implements.
 * NEVER throws and always returns a usable summary:
 *   'rules'                                   → buildTemplateSummary(facts)
 *   'ai' + LLM_PROVIDER=mock                  → mockProvider.summarize
 *   'ai' + anthropic + ANTHROPIC_API_KEY      → claude.summarize; timeout → template 'timeout'; error → template 'upstream_error'
 *   'ai' + anything else                      → buildTemplateSummary(facts, 'no_api_key')
 * AI output with verifiedBand 'partial' | 'none' keeps its text and gets reason 'low_verification'.
 */
export async function dispatchSummary(mode: SummaryMode, facts: LlmFacts): Promise<LlmSummaryResult> {
  void mode;
  void facts;
  throw new Error('not implemented in T0');
}
