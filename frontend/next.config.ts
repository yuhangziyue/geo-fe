import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // backend/ ships TypeScript source; Next compiles it in-process (one service, two directories).
  transpilePackages: ['@geo/backend'],
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
