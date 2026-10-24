import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from '../shared/paths';
import { PLATFORMS, QuestionSchema, type Facets, type Question, type ScenarioRef } from './schema';
import { TOPIC_SCENARIO } from './topic-scenario';

const readJson = (...parts: string[]): unknown =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, ...parts), 'utf8'));

let questionsCache: Question[] | null = null;
let productSlugCache: Map<string, string> | null = null;
let scenarioCache: Map<string, ScenarioRef> | null = null;

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

/** The scenario page a topic maps to (see topic-scenario.ts), or null. */
export function topicScenario(topic: string): ScenarioRef | null {
  if (!scenarioCache) {
    const rows = z
      .array(z.object({ slug: z.string(), name: z.string() }).passthrough())
      .parse(readJson('project2_knowledge', 'scenarios.json'));
    scenarioCache = new Map(rows.map((r) => [r.slug, { slug: r.slug, name: r.name }]));
  }
  const slug = TOPIC_SCENARIO[topic];
  return (slug && scenarioCache.get(slug)) || null;
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
