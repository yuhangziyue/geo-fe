import type { LlmFacts, LlmSummaryResult } from '../schema';
import { LLM_TIMEOUT_MS, LlmTimeoutError } from './errors';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { extractNumbers, verifyAgainstFacts } from './verify';

/**
 * OpenAI-compatible provider (POST {LLM_BASE_URL}/chat/completions, Bearer auth).
 * Env names match the brand-writer model adapter (ragwriter/llm/client.py): LLM_API_KEY / LLM_BASE_URL / LLM_MODEL,
 * so a DeepSeek / Qwen / OpenAI / local-gateway .env can be copied over unchanged.
 */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_MODEL = 'deepseek-chat';

/** LLM_BASE_URL when set and non-empty; trailing slashes are stripped so `${url}/chat/completions` never doubles. */
export const resolveBaseUrl = (): string => (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

/** LLM_MODEL when set and non-empty (an empty `LLM_MODEL=` line must not blank the model). */
export const resolveModel = (): string => process.env.LLM_MODEL || DEFAULT_MODEL;

export const isOpenAiEnabled = (): boolean => !!process.env.LLM_API_KEY;

/** The slice of global fetch the provider uses — tests inject a fake, so no test ever reaches the network. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SummarizeOptions {
  /** default LLM_TIMEOUT_MS (05 §3) */
  timeoutMs?: number;
  /** default resolveModel() */
  model?: string;
  /** default resolveBaseUrl() */
  baseUrl?: string;
  /** default process.env.LLM_API_KEY; used only for the Authorization header, never logged */
  apiKey?: string;
  /** default: global fetch */
  fetchImpl?: FetchLike;
}

/**
 * Sends ONLY `facts` (system + user prompt) to an OpenAI-compatible endpoint and returns mode 'ai' (model = the id
 * used) with the numbers checked by verify.ts. Throws on a non-200 / unparseable / empty reply and on timeout
 * (LlmTimeoutError); falling back to the template is the dispatcher's job.
 * Timeout: a Promise.race guard that aborts the request, so a stuck connection cannot hold the route past
 * `timeoutMs` either way.
 */
export async function summarize(facts: LlmFacts, opts?: SummarizeOptions): Promise<LlmSummaryResult> {
  const model = opts?.model ?? resolveModel();
  const timeoutMs = opts?.timeoutMs ?? LLM_TIMEOUT_MS;
  const baseUrl = (opts?.baseUrl ?? resolveBaseUrl()).replace(/\/+$/, '');
  const apiKey = opts?.apiKey ?? process.env.LLM_API_KEY ?? '';
  const fetchImpl: FetchLike = opts?.fetchImpl ?? ((input, init) => fetch(input, init));

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  let response: Response;
  try {
    response = await Promise.race([
      fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(facts) },
          ],
        }),
        signal: controller.signal,
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(`LLM provider responded ${response.status}`);
  const data: unknown = await response.json();
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('LLM provider returned a payload without choices[0].message.content');
  const text = content.trim();
  if (!text) throw new Error('LLM provider returned an empty summary');

  return { mode: 'ai', text, ...verifyAgainstFacts(extractNumbers(text), facts), model, reason: null };
}
