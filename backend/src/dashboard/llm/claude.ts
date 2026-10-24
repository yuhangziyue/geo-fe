import type { LlmFacts, LlmSummaryResult } from '../schema';

/**
 * Claude provider — T0 stub for `summarize`, B2 implements it (SDK usage: .superpowers/sdd/07-p1-v3-impl-plan/claude-sdk-notes.md).
 * The ONE place a model id is written. Override with ANTHROPIC_MODEL; never hard-code another id elsewhere.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

/** ANTHROPIC_MODEL when set and non-empty (an empty `ANTHROPIC_MODEL=` line in .env must not blank the model). */
export const resolveModel = (): string => process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

export const isLlmEnabled = (): boolean => !!process.env.ANTHROPIC_API_KEY;

/** Thrown by `summarize` when the call exceeds `timeoutMs`; the dispatcher maps it to reason 'timeout'. */
export class LlmTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`LLM call timed out after ${timeoutMs} ms`);
    this.name = 'LlmTimeoutError';
  }
}

export interface SummarizeOptions {
  /** default 15_000 (05 §3) */
  timeoutMs?: number;
  /** default resolveModel() */
  model?: string;
}

/**
 * Sends ONLY `facts` to Claude and returns mode 'ai' with the numbers checked by verify.ts.
 * Throws on SDK error (as is) and on timeout (LlmTimeoutError); falling back to the template is the dispatcher's job.
 */
export async function summarize(facts: LlmFacts, opts?: SummarizeOptions): Promise<LlmSummaryResult> {
  void facts;
  void opts;
  throw new Error('not implemented in T0');
}
