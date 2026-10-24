import { postInsight } from '@geo/backend/dashboard/http';

export const dynamic = 'force-dynamic';

export function POST(req: Request) {
  return postInsight(req);
}
