import { getActionCards } from '@geo/backend/dashboard/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return getActionCards(req);
}
