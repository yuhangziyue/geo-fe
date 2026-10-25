import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fullFacts } from './__fixtures__/facts';
import { DEFAULT_MODEL, LlmTimeoutError, isLlmEnabled, resolveModel, summarize, type MessagesClient } from './claude';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';

// Safety net: if any code path ever builds a real SDK client in this file, it gets a stub, never the network.
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class OfflineAnthropic extends actual.default {
    constructor() {
      super({ apiKey: 'test-only' });
      Object.assign(this, { beta: { messages: { create: () => Promise.reject(new Error('real SDK client must not be used in tests')) } } });
    }
  }
  return { ...actual, default: OfflineAnthropic };
});

const facts = fullFacts();
const reply = (text: string, stop_reason = 'end_turn') => ({ content: [{ type: 'text', text }], stop_reason });
const clientWith = (create: ReturnType<typeof vi.fn>): MessagesClient => ({ beta: { messages: { create } } }) as unknown as MessagesClient;

describe('claude.summarize', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_MODEL', ''));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('sends only the facts prompt and wraps the reply as an ai result with checked numbers', async () => {
    const create = vi.fn().mockResolvedValue(reply(`Visibility is ${facts.funnel.mentionRateOfAsked}% across ${facts.funnel.questions} questions.`));
    const r = await summarize(facts, { client: clientWith(create) });

    expect(r.mode).toBe('ai');
    expect(r.model).toBe(resolveModel());
    expect(r.model).toBe(DEFAULT_MODEL);
    expect(r.reason).toBeNull();
    expect(r.verification).toEqual({ verified: 2, total: 2, band: 'all' });

    const [body, options] = create.mock.calls[0];
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.system).toBe(SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: 'user', content: buildUserPrompt(facts) }]);
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('thinking');
    expect(options).toMatchObject({ timeout: 15_000, maxRetries: 0 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses ANTHROPIC_MODEL when set', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'override-model');
    const create = vi.fn().mockResolvedValue(reply('No numbers.'));
    const r = await summarize(facts, { client: clientWith(create) });
    expect(r.model).toBe('override-model');
    expect(create.mock.calls[0][0].model).toBe('override-model');
  });

  it('keeps unverified numbers flagged (the UI marks them red)', async () => {
    const create = vi.fn().mockResolvedValue(reply('Visibility is 3% on 999 questions.'));
    const r = await summarize(facts, { client: clientWith(create) });
    expect(r.numbers.map((n) => n.verified)).toEqual([false, false]);
    expect(r.verification.band).toBe('low');
  });

  it('throws LlmTimeoutError after 15 s and aborts the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const create = vi.fn().mockImplementation((_b: unknown, o: { signal: AbortSignal }) => {
      signal = o.signal;
      return new Promise(() => {});
    });
    const p = summarize(facts, { client: clientWith(create) });
    const assertion = expect(p).rejects.toBeInstanceOf(LlmTimeoutError);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it("maps the SDK's own connection timeout to LlmTimeoutError", async () => {
    const create = vi.fn().mockRejectedValue(new APIConnectionTimeoutError());
    await expect(summarize(facts, { client: clientWith(create) })).rejects.toBeInstanceOf(LlmTimeoutError);
  });

  it('lets any other SDK error bubble up', async () => {
    const boom = new Error('upstream 529');
    const create = vi.fn().mockRejectedValue(boom);
    await expect(summarize(facts, { client: clientWith(create) })).rejects.toBe(boom);
  });

  it('treats a refusal or an empty reply as an upstream error', async () => {
    await expect(summarize(facts, { client: clientWith(vi.fn().mockResolvedValue(reply('', 'refusal'))) })).rejects.toThrow(/refus/i);
    await expect(summarize(facts, { client: clientWith(vi.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn' })) })).rejects.toThrow(
      /empty/i,
    );
  });

  it('isLlmEnabled() is false without a key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isLlmEnabled()).toBe(false);
  });
});

describe('prompts', () => {
  it('system prompt holds the brief §4 rules, in English', () => {
    expect(SYSTEM_PROMPT).toContain('≤120 words');
    expect(SYSTEM_PROMPT).toContain('Every number MUST come from the FACTS block.');
    expect(SYSTEM_PROMPT).not.toMatch(/[一-鿿]/);
  });

  it('user prompt carries the facts JSON and nothing else from the data', () => {
    const p = buildUserPrompt(facts);
    expect(p).toContain(JSON.stringify(facts, null, 2));
    expect(p.startsWith(`Here are the facts about ${facts.brand} for ${facts.period.from} to ${facts.period.to}:`)).toBe(true);
    expect(p.endsWith('Write the summary now.')).toBe(true);
  });
});
