import type { LlmFacts, LlmSummaryResult } from '../schema';
import { extractNumbers, verifyAgainstFacts } from './verify';

/** Model id reported by the demo mock. Display only — the UI picks the "Mock LLM (demo)" badge from mode 'mock'. */
export const MOCK_MODEL_ID = 'mock-llm-v1';

/**
 * The deliberately wrong number (DeepSeek's real visibility is 46%). Chosen by the brief §3 script: ≥ 4 pt from
 * every %-truth and not equal to any count. mockProvider.test.ts re-checks the ≥ 2 pt distance against truth.ts.
 */
export const MOCK_WRONG_PCT = 31;

/** Brief §3 fixed text, verbatim. Changing a word means re-running the brief §3 wrong-value script. */
const mockText = (brand: string) =>
  `This month ${brand} achieved 71% visibility and 47% recommendation rate across 120 tracked questions. ` +
  `The weakest platform is DeepSeek at ${MOCK_WRONG_PCT}%, well below the overall average. ` +
  `Owned sources account for 10% of 71 citations — publish more first-party content.`;

/**
 * Demo-only LLM (05 §6, LLM_PROVIDER=mock).
 * Returns a FIXED text (only the brand name is filled in) with one deliberately wrong number, so the number check
 * visibly flags it: mode 'mock', model MOCK_MODEL_ID, verification 5/6 'partial' on the full data.
 * The check runs for real against `facts`. Reads no env — the dispatcher decides when to use it.
 */
export async function summarize(facts: LlmFacts): Promise<LlmSummaryResult> {
  const text = mockText(facts.brand);
  return { mode: 'mock', text, ...verifyAgainstFacts(extractNumbers(text), facts), model: MOCK_MODEL_ID, reason: null };
}
