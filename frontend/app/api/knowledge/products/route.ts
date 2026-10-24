import { createProductHandler, listProductsHandler } from '@geo/backend/knowledge/http';
import { revalidateAfterWrite } from '@/components/knowledge/revalidate';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return listProductsHandler(req);
}

export async function POST(req: Request) {
  const res = await createProductHandler(req);
  await revalidateAfterWrite(res);
  return res;
}
