import { listQuestions } from '@geo/backend/dashboard/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return listQuestions(req);
}
