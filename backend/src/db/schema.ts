import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const brand = sqliteTable('brand', {
  id: integer('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  website: text('website').notNull(),
  founded: text('founded').notNull(),
  headquarters: text('headquarters').notNull(),
  coreCapabilities: text('core_capabilities').notNull(), // JSON array
});

export const series = sqliteTable('series', {
  id: integer('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brand.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
});

export const product = sqliteTable('product', {
  id: integer('id').primaryKey(),
  seriesId: integer('series_id').notNull().references(() => series.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  overview: text('overview').notNull(),
  status: text('status', { enum: ['active', 'beta'] }).notNull(),
  resolution: text('resolution'), // null = not applicable (Edge series)
  connectivity: text('connectivity').notNull(),
  environment: text('environment').notNull(),
});

export const productFeature = sqliteTable('product_feature', {
  id: integer('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  text: text('text').notNull(),
});

export const productAiFeature = sqliteTable('product_ai_feature', {
  id: integer('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  text: text('text').notNull(),
});

export const scenario = sqliteTable('scenario', {
  id: integer('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
});

export const productBestFor = sqliteTable('product_best_for', {
  id: integer('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  scenarioId: integer('scenario_id').references(() => scenario.id),
});

export const faq = sqliteTable(
  'faq',
  {
    id: integer('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
  },
  (t) => [uniqueIndex('faq_product_position').on(t.productId, t.position)],
);

// Plain DDL used by the seed (no drizzle-kit migrations at runtime). Order = dependency order.
export const DDL = [
  `CREATE TABLE brand (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
     website TEXT NOT NULL, founded TEXT NOT NULL, headquarters TEXT NOT NULL, core_capabilities TEXT NOT NULL)`,
  `CREATE TABLE series (id INTEGER PRIMARY KEY, brand_id INTEGER NOT NULL REFERENCES brand(id), slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL, description TEXT NOT NULL)`,
  `CREATE TABLE product (id INTEGER PRIMARY KEY, series_id INTEGER NOT NULL REFERENCES series(id), slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL, short_description TEXT NOT NULL, overview TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('active','beta')), resolution TEXT, connectivity TEXT NOT NULL, environment TEXT NOT NULL)`,
  `CREATE TABLE product_feature (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
     position INTEGER NOT NULL, text TEXT NOT NULL)`,
  `CREATE TABLE product_ai_feature (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
     position INTEGER NOT NULL, text TEXT NOT NULL)`,
  `CREATE TABLE scenario (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL)`,
  `CREATE TABLE product_best_for (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
     position INTEGER NOT NULL, label TEXT NOT NULL, scenario_id INTEGER REFERENCES scenario(id))`,
  `CREATE TABLE faq (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
     position INTEGER NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX faq_product_position ON faq(product_id, position)`,
];
export const TABLES = ['brand', 'series', 'product', 'product_feature', 'product_ai_feature', 'scenario', 'product_best_for', 'faq'];
