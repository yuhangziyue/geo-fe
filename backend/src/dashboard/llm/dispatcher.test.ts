import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fullFacts } from './__fixtures__/facts';
import * as claude from './claude';
import { dispatchSummary } from './dispatcher';
import * as mock from './mockProvider';
import * as template from './template';

// The dispatcher takes (mode, facts) only (T0 signature lock), so its collaborators are swapped at module level.
vi.mock('./claude', async (importOriginal) => ({ ...(await importOriginal<typeof import('./claude')>()), summarize: vi.fn() }));
vi.mock('./mockProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mockProvider')>();
  return { ...actual, summarize: vi.fn(actual.summarize) };
});
vi.mock('./template', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./template')>();
  return { ...actual, buildTemplateSummary: vi.fn(actual.buildTemplateSummary) };
});

const facts = fullFacts();
const claudeSummarize = vi.mocked(claude.summarize);
const mockSummarize = vi.mocked(mock.summarize);
const buildTemplate = vi.mocked(template.buildTemplateSummary);
const aiResult = { mode: 'ai' as const, text: 'ok', numbers: [], verification: { verified: 0, total: 0, band: 'all' as const }, model: 'm', reason: null };

describe('dispatchSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("mode 'rules' → template, never touches claude or mock", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', 'mock');
    const r = await dispatchSummary('rules', facts);
    expect(r.mode).toBe('rules');
    expect(r.reason).toBeNull();
    expect(buildTemplate).toHaveBeenCalledWith(facts);
    expect(claudeSummarize).not.toHaveBeenCalled();
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it("'ai' + LLM_PROVIDER=mock → mock provider, even with a key", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', 'mock');
    const r = await dispatchSummary('ai', facts);
    expect(r.mode).toBe('mock');
    expect(r.verification).toEqual({ verified: 5, total: 6, band: 'partial' });
    expect(mockSummarize).toHaveBeenCalledWith(facts);
    expect(claudeSummarize).not.toHaveBeenCalled();
  });

  it("'ai' + anthropic + no key → template with reason no_api_key", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    const r = await dispatchSummary('ai', facts);
    expect(r).toMatchObject({ mode: 'rules', reason: 'no_api_key', model: null });
    expect(buildTemplate).toHaveBeenCalledWith(facts, 'no_api_key');
    expect(claudeSummarize).not.toHaveBeenCalled();
  });

  it("'ai' + key + LLM_PROVIDER unset → claude, result passed through", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', '');
    claudeSummarize.mockResolvedValue(aiResult);
    expect(await dispatchSummary('ai', facts)).toBe(aiResult);
    expect(claudeSummarize).toHaveBeenCalledWith(facts);
  });

  it("'ai' + key + claude throws → template with reason upstream_error", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    claudeSummarize.mockRejectedValue(new Error('529 overloaded'));
    const r = await dispatchSummary('ai', facts);
    expect(r).toMatchObject({ mode: 'rules', reason: 'upstream_error' });
    expect(buildTemplate).toHaveBeenCalledWith(facts, 'upstream_error');
  });

  it("'ai' + key + claude times out → template with reason timeout", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    claudeSummarize.mockRejectedValue(new claude.LlmTimeoutError(15_000));
    const r = await dispatchSummary('ai', facts);
    expect(r).toMatchObject({ mode: 'rules', reason: 'timeout' });
    expect(buildTemplate).toHaveBeenCalledWith(facts, 'timeout');
  });

  it("'ai' + unknown LLM_PROVIDER → template, reason no_api_key", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('LLM_PROVIDER', 'openai');
    const r = await dispatchSummary('ai', facts);
    expect(r).toMatchObject({ mode: 'rules', reason: 'no_api_key' });
    expect(claudeSummarize).not.toHaveBeenCalled();
  });

  it('never throws: a failing mock provider also falls back', async () => {
    vi.stubEnv('LLM_PROVIDER', 'mock');
    mockSummarize.mockRejectedValueOnce(new Error('bug'));
    const r = await dispatchSummary('ai', facts);
    expect(r).toMatchObject({ mode: 'rules', reason: 'upstream_error' });
  });
});
