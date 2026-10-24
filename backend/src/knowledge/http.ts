import { z } from 'zod';
import { problem } from '../shared/problem';
import { ask } from './ask';
import { RepoError, createProduct, getProduct, listProducts, listSeries, updateProduct } from './repo';
import { ProductInput, fieldErrors, type FieldErrors } from './schema';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// RFC 9457 body plus an `errors` extension member mapping field path -> message (for per-field form errors).
function validationProblem(errors: FieldErrors): Response {
  const detail = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; ');
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Invalid product', status: 400, detail, errors }), {
    status: 400,
    headers: { 'content-type': 'application/problem+json' },
  });
}

async function readBody(req: Request): Promise<unknown | Response> {
  try {
    return await req.json();
  } catch {
    return problem(400, 'Invalid JSON', 'Request body must be JSON');
  }
}

export function listProductsHandler(req: Request): Response {
  const url = new URL(req.url);
  const series = url.searchParams.get('series') ?? undefined;
  if (series && !listSeries().some((s) => s.slug === series)) return problem(400, 'Invalid parameter', `series: unknown series "${series}"`);
  return json({ items: listProducts({ series }) });
}

export function getProductHandler(slug: string): Response {
  const p = getProduct(slug);
  return p ? json(p) : problem(404, 'Not found', `No product with slug "${slug}"`);
}

async function write(req: Request, run: (input: ProductInput) => Response): Promise<Response> {
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const parsed = ProductInput.safeParse(body);
  if (!parsed.success) return validationProblem(fieldErrors(parsed.error));
  try {
    return run(parsed.data);
  } catch (err) {
    if (err instanceof RepoError) return validationProblem({ [err.field]: err.message });
    throw err;
  }
}

export function createProductHandler(req: Request): Promise<Response> {
  return write(req, (input) => json(createProduct(input), 201));
}

export function updateProductHandler(req: Request, slug: string): Promise<Response> {
  return write(req, (input) => {
    const p = updateProduct(slug, input);
    return p ? json(p) : problem(404, 'Not found', `No product with slug "${slug}"`);
  });
}

const AskBody = z.object({ question: z.string().trim().min(1, 'question is required').max(300), productSlug: z.string().optional() });

export async function askHandler(req: Request): Promise<Response> {
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const parsed = AskBody.safeParse(body);
  if (!parsed.success) return problem(400, 'Invalid question', parsed.error.issues.map((i) => i.message).join('; '));
  const { question, productSlug } = parsed.data;
  if (productSlug && !getProduct(productSlug)) return problem(404, 'Not found', `No product with slug "${productSlug}"`);
  return json(ask(question, productSlug));
}
