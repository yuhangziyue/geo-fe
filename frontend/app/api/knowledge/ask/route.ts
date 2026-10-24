import { askHandler } from '@geo/backend/knowledge/http';

export const dynamic = 'force-dynamic';

export function POST(req: Request) {
  return askHandler(req);
}
