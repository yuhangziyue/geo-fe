import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from '../shared/paths';
import { QuestionSchema, type Question } from './schema';

const readJson = (...parts: string[]): unknown =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, ...parts), 'utf8'));

let questionsCache: Question[] | null = null;
let productSlugCache: Map<string, string> | null = null;

/** Reads and validates questions.json once; throws on schema drift. */
export function loadQuestions(): Question[] {
  if (!questionsCache) {
    questionsCache = z.array(QuestionSchema).parse(readJson('project1_dashboard', 'questions.json'));
  }
  return questionsCache;
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
