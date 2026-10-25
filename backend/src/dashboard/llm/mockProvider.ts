import type { LlmFacts, LlmSummaryResult } from '../schema';

/** Model id reported by the demo mock. Display only — the UI picks the "Mock LLM (demo)" badge from mode 'mock'. */
export const MOCK_MODEL_ID = 'mock-llm-v1';

/**
 * Demo-only LLM (05 §6, LLM_PROVIDER=mock) — T0 stub, B2 implements.
 * Returns a FIXED text (B2 brief §3) with one deliberately wrong number, so the number check visibly flags it:
 * mode 'mock', model MOCK_MODEL_ID, verification 5/6 'partial'. Reads no env — the dispatcher decides when to use it.
 */
export async function summarize(facts: LlmFacts): Promise<LlmSummaryResult> {
  void facts;
  throw new Error('not implemented in T0');
}
