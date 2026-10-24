import path from 'node:path';

// Both `next dev` (cwd = frontend/) and vitest/tsx (cwd = backend/) run one level below the repo root.
export const ROOT_DIR = process.env.GEO_ROOT ?? path.resolve(process.cwd(), '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const DB_FILE = process.env.GEO_DB_FILE ?? path.join(ROOT_DIR, '.local', 'geo.db');
