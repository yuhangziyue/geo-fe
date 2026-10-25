import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DATA_DIR } from '../shared/paths';
import { TRUTH_DATA_SHAPE } from './__fixtures__/truth';
import {
  __resetScenarioCache,
  loadQuestions,
  loadTopicScenarios,
  parseQuestions,
  promptId,
  readTopicScenarios,
  TOPIC_SCENARIO_FILE,
  topicScenario,
} from './repo';

const rawRows = (): Array<Record<string, unknown>> =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'project1_dashboard', 'questions.json'), 'utf8'));
const scenarioSlugs = () =>
  new Map(
    (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'project2_knowledge', 'scenarios.json'), 'utf8')) as Array<{ slug: string; name: string }>).map(
      (s) => [s.slug, s.name],
    ),
  );
const tmpFile = (content: string | null) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-scenario-'));
  const file = path.join(dir, 'topic-scenario.json');
  if (content !== null) fs.writeFileSync(file, content);
  return file;
};

afterEach(() => __resetScenarioCache());

describe('dashboard repo', () => {
  it('derives one prompt id per distinct question text (32 prompts over 120 runs)', () => {
    const qs = loadQuestions();
    expect(new Set(qs.map((q) => q.prompt_id)).size).toBe(TRUTH_DATA_SHAPE.distinctQuestions);
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
});

describe('topic → scenario mapping (deletable topic-scenario.json)', () => {
  it('resolves slugs to scenario refs; null stays null; unknown slugs are dropped', () => {
    const file = tmpFile(JSON.stringify({ 'Topic A': 'office', 'Topic B': null, 'Topic C': 'no-such-slug' }));
    const map = readTopicScenarios(file);
    expect(map.get('Topic A')).toEqual({ slug: 'office', name: scenarioSlugs().get('office') });
    expect(map.get('Topic B')).toBeNull();
    expect(map.has('Topic C')).toBe(false);
    expect(map.get('Topic D')).toBeUndefined();
  });

  it('returns an empty Map, without throwing, when the file is missing or malformed', () => {
    expect(readTopicScenarios(tmpFile(null))).toEqual(new Map());
    expect(readTopicScenarios(tmpFile('{ not json'))).toEqual(new Map());
    expect(readTopicScenarios(tmpFile('{"Topic A": 42}'))).toEqual(new Map());
  });

  it('loadTopicScenarios caches, and after the file is deleted (and the cache reset) returns an empty Map', () => {
    const file = tmpFile(JSON.stringify({ 'Office Security': 'office' }));
    __resetScenarioCache(file);
    expect(loadTopicScenarios().size).toBe(1);
    fs.rmSync(file);
    expect(loadTopicScenarios().size).toBe(1); // cached for the process lifetime
    __resetScenarioCache(file);
    expect(loadTopicScenarios()).toEqual(new Map());
    expect(topicScenario('Office Security')).toBeNull();
  });

  it('the shipped file, when present, maps every topic and only to scenarios that exist', () => {
    // Deleting the shipped file is allowed (05 §1): this test then checks the empty map instead.
    const raw: Record<string, string | null> = fs.existsSync(TOPIC_SCENARIO_FILE)
      ? JSON.parse(fs.readFileSync(TOPIC_SCENARIO_FILE, 'utf8'))
      : {};
    const slugs = scenarioSlugs();
    for (const slug of Object.values(raw)) if (slug) expect(slugs.has(slug)).toBe(true);
    if (Object.keys(raw).length > 0) {
      for (const topic of new Set(loadQuestions().map((q) => q.topic))) expect(topic in raw).toBe(true);
    }
    expect(loadTopicScenarios().size).toBe(Object.keys(raw).length);
  });
});
