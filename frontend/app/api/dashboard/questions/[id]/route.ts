import { getQuestion } from '@geo/backend/dashboard/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return getQuestion(req, ctx);
}
