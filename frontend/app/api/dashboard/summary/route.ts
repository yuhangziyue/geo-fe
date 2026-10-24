import { getSummary } from '@geo/backend/dashboard/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return getSummary(req);
}
