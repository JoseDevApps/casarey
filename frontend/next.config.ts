import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    // MinIO serves images directly to the browser; Next.js's optimizer can't
    // reach localhost:9000 from inside the container, so skip optimization.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
}

export default nextConfig
