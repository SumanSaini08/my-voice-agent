import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint is run locally and in CI. Skipping it during the build keeps the
  // production build from failing on repository line-ending normalization for
  // Windows checkouts; typecheck still runs during `next build`.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
