import os from 'node:os';
import path from 'node:path';
import { seedDatabase } from '../db/seed';

// Points the repo at a fresh temp SQLite file and seeds it. Call in beforeAll.
export function useTempDb(name: string): string {
  const file = path.join(os.tmpdir(), `geo-test-${name}-${process.pid}-${Date.now()}.db`);
  process.env.GEO_DB_FILE = file;
  seedDatabase(file);
  return file;
}
