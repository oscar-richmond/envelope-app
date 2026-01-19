/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  typescript: {
    // Build despite type errors (but show warnings)
    ignoreBuildErrors: false,
  },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  experimental: {
    // Enable React Server Components
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude dev testing pages from production builds
  async redirects() {
    return process.env.NODE_ENV === 'production'
      ? [
        {
          source: '/dev/:path*',
          destination: '/',
          permanent: false,
        },
      ]
      : [];
  },
};

export default nextConfig;
