import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATA_DIR } from '../shared/paths';
import { currentDbFile, openSqlite } from './client';
import { DDL, TABLES } from './schema';

type RawProduct = {
  id: number; slug: string; name: string; series_slug: string; short_description: string; overview: string;
  key_features: string[]; best_for: string[]; status: 'active' | 'beta';
  specs: { resolution: string | null; connectivity: string; environment: string; ai_features: string[] };
};

function readJson<T>(name: string): T {
  const file = path.join(DATA_DIR, 'project2_knowledge', name);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

// Resets the schema inside the same DB file (never unlinks it: a running Next server may hold it open).
export function seedDatabase(file: string = currentDbFile()) {
  const brand = readJson<{ name: string; slug: string; description: string; website: string; founded: string; headquarters: string; core_capabilities: string[] }>('brand.json');
  const seriesList = readJson<Array<{ slug: string; name: string; description: string }>>('product_series.json');
  const scenarios = readJson<Array<{ id: number; slug: string; name: string; description: string }>>('scenarios.json');
  const products = readJson<RawProduct[]>('products.json');
  const faqs = readJson<Array<{ id: number; product_slug: string; question: string; answer: string }>>('faqs.json');

  const db = openSqlite(file);
  try {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      for (const t of [...TABLES].reverse()) db.exec(`DROP TABLE IF EXISTS ${t}`);
      for (const stmt of DDL) db.exec(stmt);

      const brandId = Number(
        db.prepare('INSERT INTO brand (slug,name,description,website,founded,headquarters,core_capabilities) VALUES (?,?,?,?,?,?,?)')
          .run(brand.slug, brand.name, brand.description, brand.website, brand.founded, brand.headquarters, JSON.stringify(brand.core_capabilities)).lastInsertRowid,
      );
      const seriesIds = new Map<string, number>();
      const insSeries = db.prepare('INSERT INTO series (brand_id,slug,name,description) VALUES (?,?,?,?)');
      for (const s of seriesList) seriesIds.set(s.slug, Number(insSeries.run(brandId, s.slug, s.name, s.description).lastInsertRowid));

      const scenarioByName = new Map<string, number>();
      const insScenario = db.prepare('INSERT INTO scenario (id,slug,name,description) VALUES (?,?,?,?)');
      for (const s of scenarios) { insScenario.run(s.id, s.slug, s.name, s.description); scenarioByName.set(s.name, s.id); }

      const insProduct = db.prepare(`INSERT INTO product (id,series_id,slug,name,short_description,overview,status,resolution,connectivity,environment)
        VALUES (?,?,?,?,?,?,?,?,?,?)`);
      const insFeature = db.prepare('INSERT INTO product_feature (product_id,position,text) VALUES (?,?,?)');
      const insAi = db.prepare('INSERT INTO product_ai_feature (product_id,position,text) VALUES (?,?,?)');
      const insBest = db.prepare('INSERT INTO product_best_for (product_id,position,label,scenario_id) VALUES (?,?,?,?)');
      const productIds = new Map<string, number>();
      for (const p of products) {
        const seriesId = seriesIds.get(p.series_slug);
        if (!seriesId) throw new Error(`product ${p.slug}: unknown series "${p.series_slug}"`);
        insProduct.run(p.id, seriesId, p.slug, p.name, p.short_description, p.overview, p.status,
          p.specs.resolution, p.specs.connectivity, p.specs.environment);
        productIds.set(p.slug, p.id);
        p.key_features.forEach((f, i) => insFeature.run(p.id, i, f));
        p.specs.ai_features.forEach((f, i) => insAi.run(p.id, i, f));
        // Exact-name match only; near-synonyms (e.g. "Small Retail") keep scenario_id NULL.
        p.best_for.forEach((b, i) => insBest.run(p.id, i, b, scenarioByName.get(b) ?? null));
      }

      const insFaq = db.prepare('INSERT INTO faq (id,product_id,position,question,answer) VALUES (?,?,?,?,?)');
      const pos = new Map<number, number>();
      for (const f of faqs) {
        const pid = productIds.get(f.product_slug);
        if (!pid) throw new Error(`faq ${f.id}: unknown product "${f.product_slug}"`);
        const n = (pos.get(pid) ?? 0) + 1;
        pos.set(pid, n);
        insFaq.run(f.id, pid, n, f.question, f.answer);
      }
    })();
    db.pragma('foreign_keys = ON');
    return { products: products.length, series: seriesList.length, faqs: faqs.length, scenarios: scenarios.length };
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    const file = currentDbFile();
    const counts = seedDatabase(file);
    console.log(`[seed] ${file}:`, counts);
  } catch (err) {
    console.error('[seed] failed:', err instanceof Error ? err.message : err);
    console.error('[seed] If better-sqlite3 failed to load, run `pnpm rebuild better-sqlite3` (needs Node >= 18.18).');
    process.exit(1);
  }
}
