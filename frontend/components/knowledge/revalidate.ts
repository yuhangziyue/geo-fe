import { revalidatePath } from 'next/cache';

// Called by write route handlers after a successful save so static product pages, the list and the sitemap regenerate.
export async function revalidateAfterWrite(res: Response, ...extraSlugs: string[]): Promise<void> {
  if (!res.ok) return;
  const body = (await res.clone().json()) as { slug?: string };
  revalidatePath('/products');
  for (const slug of new Set([body.slug, ...extraSlugs].filter(Boolean))) revalidatePath(`/products/${slug}`);
  revalidatePath('/sitemap.xml');
  revalidatePath('/admin/products');
}
