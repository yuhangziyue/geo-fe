// Public site origin for JSON-LD @ids, canonical links, sitemap, robots.txt and llms.txt. The only reader of SITE_URL.

type Env = Record<string, string | undefined>;

/** `pnpm demo` serves here; the project is run locally, so an unset SITE_URL is normal, not an error. */
const LOCAL_ORIGIN = 'http://localhost:3000';

/**
 * Returns the site origin without a trailing slash; unset → the local demo origin.
 * Set but malformed → throws: a wrong value would otherwise end up silently in every structured-data URL.
 */
export function siteUrl(env: Env = process.env): string {
  const raw = env.SITE_URL?.trim();
  if (!raw) return LOCAL_ORIGIN;
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // reported below
  }
  const isOrigin = url && (url.protocol === 'http:' || url.protocol === 'https:') && url.pathname === '/' && !url.search && !url.hash;
  if (!url || !isOrigin) {
    throw new Error(`SITE_URL must be an http(s) origin such as https://example.com (no path, query or hash); got "${raw}"`);
  }
  return url.origin;
}

/**
 * The one line a production build should print when falling back to localhost, else null.
 * Called from next.config.ts (main process, once) — not from siteUrl(), which build workers call many times.
 */
export function siteUrlNotice(env: Env = process.env): string | null {
  return env.NODE_ENV === 'production' && !env.SITE_URL?.trim()
    ? `SITE_URL is not set; using ${LOCAL_ORIGIN} for canonical, sitemap and JSON-LD URLs.`
    : null;
}
