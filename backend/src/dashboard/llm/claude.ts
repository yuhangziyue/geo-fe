import Anthropic, { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import type { LlmFacts, LlmSummaryResult } from '../schema';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { extractNumbers, verifyAgainstFacts } from './verify';

/**
 * Claude provider (SDK usage: .superpowers/sdd/07-p1-v3-impl-plan/claude-sdk-notes.md).
 * The ONE place a model id is written. Override with ANTHROPIC_MODEL; never hard-code another id elsewhere.
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

/** ANTHROPIC_MODEL when set and non-empty (an empty `ANTHROPIC_MODEL=` line in .env must not blank the model). */
export const resolveModel = (): string => process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

export const isLlmEnabled = (): boolean => !!process.env.ANTHROPIC_API_KEY;

/** 05 §3: the AI call gets 15 s in total (no retries), then the dispatcher falls back to the template. */
export const LLM_TIMEOUT_MS = 15_000;

/** Thrown by `summarize` when the call exceeds `timeoutMs`; the dispatcher maps it to reason 'timeout'. */
export class LlmTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`LLM call timed out after ${timeoutMs} ms`);
    this.name = 'LlmTimeoutError';
  }
}

/** The slice of the SDK client this module uses — tests inject a fake, so no test ever reaches the network. */
export type MessagesClient = Pick<Anthropic, 'beta'>;

export interface SummarizeOptions {
  /** default LLM_TIMEOUT_MS (05 §3) */
  timeoutMs?: number;
  /** default resolveModel() */
  model?: string;
  /** default: a real client, which reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL if set) from the env */
  client?: MessagesClient;
}

let sharedClient: MessagesClient | null = null;
const defaultClient = (): MessagesClient => (sharedClient ??= new Anthropic());

/**
 * Sends ONLY `facts` (as the user prompt) to Claude and returns mode 'ai' (model = the id used) with the numbers
 * checked by verify.ts. Throws on SDK error (as is), on a refusal / empty reply, and on timeout (LlmTimeoutError);
 * falling back to the template is the dispatcher's job.
 * Timeout: the SDK's own `timeout` plus a Promise.race guard that aborts the request, so a stuck stream cannot
 * hold the route past `timeoutMs` either way.
 */
export async function summarize(facts: LlmFacts, opts?: SummarizeOptions): Promise<LlmSummaryResult> {
  const model = opts?.model ?? resolveModel();
  const timeoutMs = opts?.timeoutMs ?? LLM_TIMEOUT_MS;
  const client = opts?.client ?? defaultClient();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await Promise.race([
      client.beta.messages.create(
        {
          model,
          max_tokens: 2000,
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(facts) }],
        },
        { timeout: timeoutMs, maxRetries: 0, signal: controller.signal },
      ),
      deadline,
    ]);
  } catch (err) {
    if (err instanceof APIConnectionTimeoutError) throw new LlmTimeoutError(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (response.stop_reason === 'refusal') throw new Error('Claude refused to write the summary');
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('Claude returned an empty summary');

  return { mode: 'ai', text, ...verifyAgainstFacts(extractNumbers(text), facts), model, reason: null };
}
