import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fullFacts } from './__fixtures__/facts';
import { LlmTimeoutError } from './errors';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, isOpenAiEnabled, resolveBaseUrl, resolveModel, summarize } from './openai';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';

const facts = fullFacts();
const API_KEY = 'test-llm-key';

/** A minimal Response: summarize() only reads ok/status and json(). */
const httpResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  }) as unknown as Response;

const completion = (content: string) => ({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] });

/** Every test injects its fetch: nothing in this file ever reaches the network. */
const fetchWith = (response: Response): { fetchImpl: ReturnType<typeof vi.fn> } => ({
  fetchImpl: vi.fn().mockResolvedValue(response),
});

describe('openai.summarize', () => {
  beforeEach(() => {
    vi.stubEnv('LLM_API_KEY', API_KEY);
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_MODEL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('posts the facts prompt to the OpenAI-compatible chat completions endpoint and checks the reply numbers', async () => {
    const { fetchImpl } = fetchWith(httpResponse(completion(`Visibility is ${facts.funnel.mentionRateOfAsked}% across ${facts.funnel.questions} questions.`)));
    const r = await summarize(facts, { fetchImpl });

    expect(r.mode).toBe('ai');
    expect(r.model).toBe(DEFAULT_MODEL);
    expect(r.reason).toBeNull();
    expect(r.verification).toEqual({ verified: 2, total: 2, band: 'all' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${DEFAULT_BASE_URL}/chat/completions`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      model: DEFAULT_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(facts) },
      ],
    });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('flags numbers that are not in the facts (the UI marks them red)', async () => {
    const { fetchImpl } = fetchWith(httpResponse(completion('Visibility is 3% on 999 questions.')));
    const r = await summarize(facts, { fetchImpl });
    expect(r.numbers.map((n) => n.verified)).toEqual([false, false]);
    expect(r.verification.band).toBe('low');
  });

  it('uses LLM_BASE_URL (trailing slash stripped) and LLM_MODEL from the env', async () => {
    vi.stubEnv('LLM_BASE_URL', 'https://gateway.example.com/v1///');
    vi.stubEnv('LLM_MODEL', 'qwen-plus');
    const { fetchImpl } = fetchWith(httpResponse(completion('No numbers here.')));
    const r = await summarize(facts, { fetchImpl });
    expect(r.model).toBe('qwen-plus');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://gateway.example.com/v1/chat/completions');
    expect(JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string).model).toBe('qwen-plus');
  });

  it('explicit options override the env and the defaults', async () => {
    const { fetchImpl } = fetchWith(httpResponse(completion('Steady.')));
    await summarize(facts, { fetchImpl, baseUrl: 'http://127.0.0.1:4000/v1/', model: 'local-model', apiKey: 'other-key' });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:4000/v1/chat/completions');
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer other-key');
    expect(JSON.parse(init.body as string).model).toBe('local-model');
  });

  it('throws on a non-200 response so the dispatcher falls back (upstream_error)', async () => {
    const { fetchImpl } = fetchWith(httpResponse({ error: { message: 'rate limited' } }, { ok: false, status: 429 }));
    await expect(summarize(facts, { fetchImpl })).rejects.toThrow(/429/);
  });

  it('throws when the response body is not JSON', async () => {
    const { fetchImpl } = fetchWith(httpResponse(new SyntaxError('Unexpected token < in JSON')));
    await expect(summarize(facts, { fetchImpl })).rejects.toBeInstanceOf(SyntaxError);
  });

  it('throws on a malformed completion payload', async () => {
    const noChoices = fetchWith(httpResponse({}));
    await expect(summarize(facts, noChoices)).rejects.toThrow(/choices/i);
    const emptyContent = fetchWith(httpResponse(completion('   ')));
    await expect(summarize(facts, emptyContent)).rejects.toThrow(/empty/i);
  });

  it('lets a network failure bubble up for the dispatcher to degrade', async () => {
    const boom = new TypeError('fetch failed');
    const fetchImpl = vi.fn().mockRejectedValue(boom);
    await expect(summarize(facts, { fetchImpl })).rejects.toBe(boom);
  });

  it('throws LlmTimeoutError after 15 s and aborts the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    const p = summarize(facts, { fetchImpl });
    const assertion = expect(p).rejects.toBeInstanceOf(LlmTimeoutError);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('isOpenAiEnabled() reflects LLM_API_KEY; resolve helpers use the brand-writer defaults', () => {
    expect(isOpenAiEnabled()).toBe(true);
    expect(resolveBaseUrl()).toBe(DEFAULT_BASE_URL);
    expect(resolveModel()).toBe(DEFAULT_MODEL);
    vi.stubEnv('LLM_API_KEY', '');
    expect(isOpenAiEnabled()).toBe(false);
  });
});
