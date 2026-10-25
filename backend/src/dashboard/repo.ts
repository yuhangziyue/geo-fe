import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR, ROOT_DIR } from '../shared/paths';
import { PLATFORMS, QuestionSchema, type Facets, type Question, type ScenarioRef, type TopicScenarioMap } from './schema';

const readJson = (...parts: string[]): unknown =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, ...parts), 'utf8'));

let questionsCache: Question[] | null = null;
let productSlugCache: Map<string, string> | null = null;

/**
 * Stable id for a prompt: FNV-1a of its normalized text. The data has no prompt id; rows of the same prompt
 * share the exact text (and always the same topic and intent), so the text is the prompt's identity.
 */
export function promptId(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of text.trim().toLowerCase().replace(/\s+/g, ' ')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `p_${h.toString(16).padStart(8, '0')}`;
}

/** Validates raw rows (shape + business rules) and derives prompt_id. Throws on drift. */
export function parseQuestions(raw: unknown): Question[] {
  return z.array(QuestionSchema).parse(raw).map((q) => ({ ...q, prompt_id: promptId(q.question) }));
}

/** Reads and validates questions.json once. */
export function loadQuestions(): Question[] {
  if (!questionsCache) questionsCache = parseQuestions(readJson('project1_dashboard', 'questions.json'));
  return questionsCache;
}

/**
 * A run by its URL id, or null when the id is not a plain digit string or names no run. Used by the detail page
 * on the server, so a bad id answers with a real 404 (notFound()) instead of an empty client state.
 */
export function findQuestionById(raw: string): Question | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return loadQuestions().find((q) => q.id === id) ?? null;
}

/**
 * Topic → Knowledge Center scenario slug, hand-curated by the content team (05 §1). Deletable: without it every
 * topic falls back to `/products` and nothing else changes. Resolved from the repo root (as DATA_DIR is), not from
 * `import.meta.url`, which points into the bundle under `next build`.
 */
export const TOPIC_SCENARIO_FILE = path.join(ROOT_DIR, 'backend', 'src', 'dashboard', 'topic-scenario.json');

const TopicScenarioFileSchema = z.record(z.string(), z.string().min(1).nullable());

/**
 * Reads a topic → scenario file into a TopicScenarioMap. Never throws: a missing, unreadable or malformed file
 * (or a missing scenarios.json) gives an EMPTY map. A slug that is not in scenarios.json is dropped (→ /products).
 */
export function readTopicScenarios(file: string): TopicScenarioMap {
  try {
    if (!fs.existsSync(file)) return new Map();
    const mapping = TopicScenarioFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    const scenarios = new Map(
      z
        .array(z.object({ slug: z.string(), name: z.string() }).passthrough())
        .parse(readJson('project2_knowledge', 'scenarios.json'))
        .map((r): [string, ScenarioRef] => [r.slug, { slug: r.slug, name: r.name }]),
    );
    const out = new Map<string, ScenarioRef | null>();
    for (const [topic, slug] of Object.entries(mapping)) {
      if (slug === null) out.set(topic, null);
      else if (scenarios.has(slug)) out.set(topic, scenarios.get(slug)!);
    }
    return out;
  } catch (e) {
    console.warn('[dashboard] topic-scenario mapping ignored:', e instanceof Error ? e.message : e);
    return new Map();
  }
}

let scenarioFile = TOPIC_SCENARIO_FILE;
let scenarioMapCache: TopicScenarioMap | null = null;

/** The topic → scenario map, read once per process. Empty when topic-scenario.json is deleted. */
export function loadTopicScenarios(): TopicScenarioMap {
  if (!scenarioMapCache) scenarioMapCache = readTopicScenarios(scenarioFile);
  return scenarioMapCache;
}

/** Test hook: drop the cache, optionally pointing the loader at another file. Not used at runtime. */
export function __resetScenarioCache(file: string = TOPIC_SCENARIO_FILE): void {
  scenarioFile = file;
  scenarioMapCache = null;
}

/** The scenario page a topic maps to, or null (unmapped, deliberately null, or mapping file deleted). */
export function topicScenario(topic: string): ScenarioRef | null {
  return loadTopicScenarios().get(topic) ?? null;
}

/** Filter options taken from the full dataset (not the filtered rows), so a narrowed view can still switch. */
export function loadFacets(): Facets {
  const rows = loadQuestions();
  return {
    platforms: PLATFORMS.filter((p) => rows.some((q) => q.platform === p)),
    topics: [...new Set(rows.map((q) => q.topic))].sort(),
    intents: [...new Set(rows.map((q) => q.intent_type))].sort(),
  };
}

export function loadBrand(): { brand: string; period: string } {
  const raw = z
    .object({ brand: z.string(), period: z.string() })
    .parse(readJson('project1_dashboard', 'dashboard_summary.json'));
  return { brand: raw.brand, period: raw.period };
}

/** Product name → P2 slug, so P1 detail can link into the Knowledge Center. */
export function productSlugs(): Map<string, string> {
  if (!productSlugCache) {
    const rows = z
      .array(z.object({ name: z.string(), slug: z.string() }).passthrough())
      .parse(readJson('project2_knowledge', 'products.json'));
    productSlugCache = new Map(rows.map((r) => [r.name, r.slug]));
  }
  return productSlugCache;
}
