/** Timeout contract shared by every LLM provider; the dispatcher maps it to the 'timeout' template fallback. */

/** 05 §3: the AI call gets 15 s in total (no retries), then the dispatcher falls back to the template. */
export const LLM_TIMEOUT_MS = 15_000;

/** Thrown by a provider when the call exceeds `timeoutMs`; the dispatcher maps it to reason 'timeout'. */
export class LlmTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`LLM call timed out after ${timeoutMs} ms`);
    this.name = 'LlmTimeoutError';
  }
}
