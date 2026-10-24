import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // backend/ ships TypeScript source; Next compiles it in-process (one service, two directories).
  transpilePackages: ['@geo/backend'],
  serverExternalPackages: ['better-sqlite3'],
  // End-to-end runs build into their own folder, so they never clobber a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
