import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '../shared/paths';
import { loadQuestions, parseQuestions, promptId } from './repo';
import { TOPIC_SCENARIO } from './topic-scenario';

const rawRows = (): Array<Record<string, unknown>> =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'project1_dashboard', 'questions.json'), 'utf8'));

describe('dashboard repo', () => {
  it('derives one prompt id per distinct question text (32 prompts over 120 runs)', () => {
    const qs = loadQuestions();
    expect(new Set(qs.map((q) => q.prompt_id)).size).toBe(32);
    expect(promptId('  Which  camera? ')).toBe(promptId('which camera?'));
  });

  it('keeps topic and intent constant within a prompt, so they belong to the prompt', () => {
    const byPrompt = new Map<string, Set<string>>();
    for (const q of loadQuestions()) {
      byPrompt.set(q.prompt_id, (byPrompt.get(q.prompt_id) ?? new Set()).add(`${q.topic}|${q.intent_type}`));
    }
    for (const s of byPrompt.values()) expect(s.size).toBe(1);
  });

  it('rejects rows that break the business rules, not just the shape', () => {
    const [row] = rawRows();
    const bad = (patch: Record<string, unknown>) => () => parseQuestions([{ ...row, ...patch }]);
    expect(bad({ brand_mentioned: false, brand_recommended: true, mentioned_products: [] })).toThrow(/recommended without being mentioned/);
    expect(bad({ brand_mentioned: false, brand_recommended: false, mentioned_products: ['Nova X4'] })).toThrow(/names a product/);
    expect(bad({ citation_count: 99 })).toThrow(/citation_count/);
  });

  it('maps topics only to scenarios that exist in scenarios.json', () => {
    const slugs = new Set(
      (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'project2_knowledge', 'scenarios.json'), 'utf8')) as Array<{ slug: string }>).map((s) => s.slug),
    );
    for (const slug of Object.values(TOPIC_SCENARIO)) if (slug) expect(slugs.has(slug)).toBe(true);
    for (const topic of new Set(loadQuestions().map((q) => q.topic))) expect(topic in TOPIC_SCENARIO).toBe(true);
  });
});
