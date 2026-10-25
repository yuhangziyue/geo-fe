import type { LlmFacts, LlmSummaryResult, SummaryMode } from '../schema';
import { LlmTimeoutError, isLlmEnabled, summarize as claudeSummarize } from './claude';
import { summarize as mockSummarize } from './mockProvider';
import { buildTemplateSummary } from './template';

/** LLM_PROVIDER values; unset = 'anthropic'. Any other value falls back to the template summary. */
export type LlmProvider = 'anthropic' | 'mock';

const provider = (): string => process.env.LLM_PROVIDER || 'anthropic';

function fallback(facts: LlmFacts, err: unknown): LlmSummaryResult {
  const reason = err instanceof LlmTimeoutError ? 'timeout' : 'upstream_error';
  // the message only — never the request, which would carry headers
  console.warn(`[action-center] AI summary fell back to rules (${reason}): ${err instanceof Error ? err.message : String(err)}`);
  return buildTemplateSummary(facts, reason);
}

/**
 * The single entry point for POST /api/dashboard/action-center/summary.
 * NEVER throws and always returns a usable summary:
 *   'rules'                                   → buildTemplateSummary(facts)
 *   'ai' + LLM_PROVIDER=mock                  → mockProvider.summarize (a key, if any, is ignored)
 *   'ai' + anthropic + ANTHROPIC_API_KEY      → claude.summarize; timeout → template 'timeout'; error → template 'upstream_error'
 *   'ai' + anything else                      → buildTemplateSummary(facts, 'no_api_key')
 *                                               (no key, or an unknown LLM_PROVIDER: either way no AI is configured)
 * AI / mock output is returned as is, whatever its verification band; the UI derives the badge from `verification.band`.
 */
export async function dispatchSummary(mode: SummaryMode, facts: LlmFacts): Promise<LlmSummaryResult> {
  if (mode === 'rules') return buildTemplateSummary(facts);
  const p = provider();
  try {
    if (p === 'mock') return await mockSummarize(facts);
    if (p === 'anthropic' && isLlmEnabled()) return await claudeSummarize(facts);
  } catch (err) {
    return fallback(facts, err);
  }
  return buildTemplateSummary(facts, 'no_api_key');
}
