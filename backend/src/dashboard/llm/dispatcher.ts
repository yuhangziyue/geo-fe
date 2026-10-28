import type { LlmFacts, LlmSummaryResult, SummaryMode } from '../schema';
import { summarize as claudeSummarize, isLlmEnabled } from './claude';
import { LlmTimeoutError } from './errors';
import { summarize as mockSummarize } from './mockProvider';
import { isOpenAiEnabled, summarize as openAiSummarize } from './openai';
import { buildTemplateSummary } from './template';

/** Explicit LLM_PROVIDER values. Any other value falls back to the template, reason 'unknown_provider'. */
export type LlmProvider = 'anthropic' | 'mock' | 'openai';
const PROVIDERS: readonly string[] = ['anthropic', 'mock', 'openai'] satisfies readonly LlmProvider[];

/**
 * Which provider backs the 'ai' mode.
 *   LLM_PROVIDER set        → that value wins, exactly (a typo is 'unknown_provider'; its own key missing is 'no_api_key')
 *   LLM_PROVIDER unset      → auto-detect from the keys present:
 *                               ANTHROPIC_API_KEY present → anthropic (also when BOTH keys are set — the deterministic
 *                               tie-break that keeps the pre-openai default), else LLM_API_KEY present → openai,
 *                               else 'anthropic', which then reports 'no_api_key'.
 */
function resolveProvider(): string {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit) return explicit;
  if (isLlmEnabled()) return 'anthropic';
  if (isOpenAiEnabled()) return 'openai';
  return 'anthropic';
}

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
 *   'ai' + LLM_PROVIDER=mock                  → mockProvider.summarize (keys, if any, are ignored)
 *   'ai' + anthropic + ANTHROPIC_API_KEY      → claude.summarize; timeout → template 'timeout'; error → template 'upstream_error'
 *   'ai' + openai + LLM_API_KEY               → openai.summarize against LLM_BASE_URL / LLM_MODEL (OpenAI-compatible
 *                                               chat completions, e.g. DeepSeek); same timeout / error fallbacks
 *   'ai' + provider unset                     → anthropic when ANTHROPIC_API_KEY is set, openai when only LLM_API_KEY
 *                                               is set, otherwise the no-key template below
 *   'ai' + unknown LLM_PROVIDER (e.g. a typo) → buildTemplateSummary(facts, 'unknown_provider'), whether a key is set or not
 *   'ai' + named provider without its key     → buildTemplateSummary(facts, 'no_api_key')
 * AI / mock output is returned as is, whatever its verification band; the UI derives the badge from `verification.band`.
 */
export async function dispatchSummary(mode: SummaryMode, facts: LlmFacts): Promise<LlmSummaryResult> {
  if (mode === 'rules') return buildTemplateSummary(facts);
  const p = resolveProvider();
  if (!PROVIDERS.includes(p)) {
    console.warn(`[action-center] unknown LLM_PROVIDER "${p}" (expected ${PROVIDERS.join(' | ')}); using the rule-based summary`);
    return buildTemplateSummary(facts, 'unknown_provider');
  }
  try {
    if (p === 'mock') return await mockSummarize(facts);
    if (p === 'anthropic' && isLlmEnabled()) return await claudeSummarize(facts);
    if (p === 'openai' && isOpenAiEnabled()) return await openAiSummarize(facts);
  } catch (err) {
    return fallback(facts, err);
  }
  return buildTemplateSummary(facts, 'no_api_key');
}
