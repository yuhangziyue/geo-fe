import { getProductHandler, updateProductHandler } from '@geo/backend/knowledge/http';
import { revalidateAfterWrite } from '@/components/knowledge/revalidate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  return getProductHandler(slug);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const res = await updateProductHandler(req, slug);
  await revalidateAfterWrite(res, slug);
  return res;
}
