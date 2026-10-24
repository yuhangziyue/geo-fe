import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { DB_FILE } from '../shared/paths';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const cache = new Map<string, Db>();

// Resolved lazily so tests can point GEO_DB_FILE at a temp file.
export function currentDbFile(): string {
  return process.env.GEO_DB_FILE ?? DB_FILE;
}

export function openSqlite(file: string): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 3000');
  return sqlite;
}

export function getDb(file: string = currentDbFile()): Db {
  let db = cache.get(file);
  if (!db) {
    db = drizzle(openSqlite(file), { schema }) as Db;
    cache.set(file, db);
  }
  return db;
}
