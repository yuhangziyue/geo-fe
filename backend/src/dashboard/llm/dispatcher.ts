import type { LlmFacts, LlmSummaryResult, SummaryMode } from '../schema';
import { LlmTimeoutError, isLlmEnabled, summarize as claudeSummarize } from './claude';
import { summarize as mockSummarize } from './mockProvider';
import { buildTemplateSummary } from './template';

/** LLM_PROVIDER values; unset = 'anthropic'. Any other value falls back to the template, reason 'unknown_provider'. */
export type LlmProvider = 'anthropic' | 'mock';
const PROVIDERS: readonly string[] = ['anthropic', 'mock'] satisfies readonly LlmProvider[];

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
 *   'ai' + unknown LLM_PROVIDER (e.g. a typo) → buildTemplateSummary(facts, 'unknown_provider'), whether a key is set or not
 *   'ai' + anthropic without a key            → buildTemplateSummary(facts, 'no_api_key')
 * AI / mock output is returned as is, whatever its verification band; the UI derives the badge from `verification.band`.
 */
export async function dispatchSummary(mode: SummaryMode, facts: LlmFacts): Promise<LlmSummaryResult> {
  if (mode === 'rules') return buildTemplateSummary(facts);
  const p = provider();
  if (!PROVIDERS.includes(p)) {
    console.warn(`[action-center] unknown LLM_PROVIDER "${p}" (expected ${PROVIDERS.join(' | ')}); using the rule-based summary`);
    return buildTemplateSummary(facts, 'unknown_provider');
  }
  try {
    if (p === 'mock') return await mockSummarize(facts);
    if (p === 'anthropic' && isLlmEnabled()) return await claudeSummarize(facts);
  } catch (err) {
    return fallback(facts, err);
  }
  return buildTemplateSummary(facts, 'no_api_key');
}
