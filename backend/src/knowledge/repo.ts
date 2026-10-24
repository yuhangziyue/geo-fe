import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as t from '../db/schema';
import type { Brand, ProductDetail, ProductInput, ProductSummary, SeriesInfo, Specs } from './schema';

export class RepoError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

type ProductRow = typeof t.product.$inferSelect;

function summaryRows(seriesSlug?: string) {
  const db = getDb();
  const q = db
    .select({ p: t.product, s: { slug: t.series.slug, name: t.series.name } })
    .from(t.product)
    .innerJoin(t.series, eq(t.product.seriesId, t.series.id));
  return (seriesSlug ? q.where(eq(t.series.slug, seriesSlug)) : q).orderBy(asc(t.product.id)).all();
}

function toSummary(p: ProductRow, s: { slug: string; name: string }): ProductSummary {
  return {
    slug: p.slug, name: p.name, status: p.status, shortDescription: p.shortDescription, series: s,
    features: texts(t.productFeature, p.id),
    specs: { resolution: p.resolution, connectivity: p.connectivity, environment: p.environment },
  };
}

function texts(table: typeof t.productFeature | typeof t.productAiFeature, productId: number): string[] {
  return getDb().select({ text: table.text }).from(table).where(eq(table.productId, productId)).orderBy(asc(table.position)).all().map((r) => r.text);
}

function specsOf(p: ProductRow): Specs {
  return { resolution: p.resolution, connectivity: p.connectivity, environment: p.environment, aiFeatures: texts(t.productAiFeature, p.id) };
}

export function listProducts(f: { series?: string; scenario?: string } = {}): ProductSummary[] {
  let rows = summaryRows(f.series);
  if (f.scenario) {
    const ids = new Set(
      getDb().select({ id: t.productBestFor.productId }).from(t.productBestFor)
        .innerJoin(t.scenario, eq(t.productBestFor.scenarioId, t.scenario.id))
        .where(eq(t.scenario.slug, f.scenario)).all().map((r) => r.id),
    );
    rows = rows.filter((r) => ids.has(r.p.id));
  }
  return rows.map((r) => toSummary(r.p, r.s));
}

export function listSeries(): SeriesInfo[] {
  return getDb()
    .select({ slug: t.series.slug, name: t.series.name, description: t.series.description, productCount: sql<number>`count(${t.product.id})` })
    .from(t.series).leftJoin(t.product, eq(t.product.seriesId, t.series.id))
    .groupBy(t.series.id).orderBy(asc(t.series.id)).all();
}

export function getBrand(): Brand {
  const b = getDb().select().from(t.brand).limit(1).get();
  if (!b) throw new Error('brand not seeded');
  return { name: b.name, slug: b.slug, description: b.description, website: b.website, founded: b.founded, headquarters: b.headquarters, coreCapabilities: JSON.parse(b.coreCapabilities) as string[] };
}

export function countAll() {
  const db = getDb();
  const n = (table: typeof t.product | typeof t.series | typeof t.faq | typeof t.scenario) =>
    db.select({ n: sql<number>`count(*)` }).from(table).get()!.n;
  return { products: n(t.product), series: n(t.series), faqs: n(t.faq), scenarios: n(t.scenario) };
}

export function getProduct(slug: string): ProductDetail | null {
  const db = getDb();
  const row = db.select({ p: t.product, s: t.series }).from(t.product)
    .innerJoin(t.series, eq(t.product.seriesId, t.series.id)).where(eq(t.product.slug, slug)).get();
  if (!row) return null;
  const { p, s } = row;
  const bestFor = db.select({ label: t.productBestFor.label, scenarioSlug: t.scenario.slug }).from(t.productBestFor)
    .leftJoin(t.scenario, eq(t.productBestFor.scenarioId, t.scenario.id))
    .where(eq(t.productBestFor.productId, p.id)).orderBy(asc(t.productBestFor.position)).all()
    .map((b) => ({ label: b.label, scenarioSlug: b.scenarioSlug ?? null }));
  const faqs = db.select({ id: t.faq.id, position: t.faq.position, question: t.faq.question, answer: t.faq.answer })
    .from(t.faq).where(eq(t.faq.productId, p.id)).orderBy(asc(t.faq.position)).all();
  const siblings = db.select().from(t.product).where(eq(t.product.seriesId, s.id)).orderBy(asc(t.product.id)).all()
    .filter((x) => x.id !== p.id)
    .map((x) => ({ slug: x.slug, name: x.name, status: x.status, specs: specsOf(x) }));
  return {
    ...toSummary(p, { slug: s.slug, name: s.name }),
    id: p.id, overview: p.overview, features: texts(t.productFeature, p.id), bestFor, faqs,
    specs: specsOf(p), seriesSiblings: siblings,
  };
}

function writeChildren(productId: number, input: ProductInput) {
  const db = getDb();
  db.delete(t.productFeature).where(eq(t.productFeature.productId, productId)).run();
  db.delete(t.productAiFeature).where(eq(t.productAiFeature.productId, productId)).run();
  db.delete(t.productBestFor).where(eq(t.productBestFor.productId, productId)).run();
  input.keyFeatures.forEach((text, position) => db.insert(t.productFeature).values({ productId, position, text }).run());
  input.specs.aiFeatures.forEach((text, position) => db.insert(t.productAiFeature).values({ productId, position, text }).run());
  const scenarios = db.select().from(t.scenario).all();
  input.bestFor.forEach((label, position) => {
    const scenarioId = scenarios.find((s) => s.name === label)?.id ?? null;
    db.insert(t.productBestFor).values({ productId, position, label, scenarioId }).run();
  });
}

function productValues(input: ProductInput) {
  const s = getDb().select({ id: t.series.id }).from(t.series).where(eq(t.series.slug, input.seriesSlug)).get();
  if (!s) throw new RepoError('seriesSlug', `unknown series "${input.seriesSlug}"`);
  return {
    seriesId: s.id, slug: input.slug, name: input.name, shortDescription: input.shortDescription, overview: input.overview,
    status: input.status, resolution: input.specs.resolution, connectivity: input.specs.connectivity, environment: input.specs.environment,
  };
}

function slugTaken(slug: string, exceptId?: number) {
  const r = getDb().select({ id: t.product.id }).from(t.product).where(eq(t.product.slug, slug)).get();
  return !!r && r.id !== exceptId;
}

// Throws RepoError on business-rule violations (duplicate slug, unknown series).
export function createProduct(input: ProductInput): ProductDetail {
  const db = getDb();
  db.transaction(() => {
    if (slugTaken(input.slug)) throw new RepoError('slug', `slug "${input.slug}" is already in use`);
    const id = Number(db.insert(t.product).values(productValues(input)).run().lastInsertRowid);
    writeChildren(id, input);
  });
  return getProduct(input.slug)!;
}

export function updateProduct(slug: string, input: ProductInput): ProductDetail | null {
  const db = getDb();
  const existing = db.select({ id: t.product.id }).from(t.product).where(eq(t.product.slug, slug)).get();
  if (!existing) return null;
  db.transaction(() => {
    if (slugTaken(input.slug, existing.id)) throw new RepoError('slug', `slug "${input.slug}" is already in use`);
    db.update(t.product).set(productValues(input)).where(eq(t.product.id, existing.id)).run();
    writeChildren(existing.id, input);
  });
  return getProduct(input.slug)!;
}
