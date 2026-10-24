import { revalidatePath } from 'next/cache';
import { listScenarios } from '@geo/backend/knowledge/repo';

// Called by write route handlers after a successful save so static product and scenario pages, the list, sitemap and llms.txt regenerate.
export async function revalidateAfterWrite(res: Response, ...extraSlugs: string[]): Promise<void> {
  if (!res.ok) return;
  const body = (await res.clone().json()) as { slug?: string };
  revalidatePath('/products');
  for (const slug of new Set([body.slug, ...extraSlugs].filter(Boolean))) revalidatePath(`/products/${slug}`);
  revalidatePath('/sitemap.xml');
  revalidatePath('/llms.txt');
  // best_for may add or drop a product from any scenario page; concrete paths avoid route-group pattern pitfalls.
  for (const s of listScenarios()) revalidatePath(`/scenarios/${s.slug}`);
  revalidatePath('/admin/products');
}
