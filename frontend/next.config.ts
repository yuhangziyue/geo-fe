import type { NextConfig } from 'next';
import { siteUrl, siteUrlNotice } from '../backend/src/shared/site';

// A malformed SITE_URL fails here, before any page is built. Build workers load this file again but inherit the
// main process's env, so the flag keeps the "falling back to localhost" notice to one line per build.
siteUrl();
const notice = siteUrlNotice();
if (notice && !process.env.GEO_SITE_URL_NOTICE_SHOWN) {
  process.env.GEO_SITE_URL_NOTICE_SHOWN = '1';
  console.warn(notice);
}

const nextConfig: NextConfig = {
  // backend/ ships TypeScript source; Next compiles it in-process (one service, two directories).
  transpilePackages: ['@geo/backend'],
  serverExternalPackages: ['better-sqlite3'],
  // End-to-end runs build into their own folder, so they never clobber a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
