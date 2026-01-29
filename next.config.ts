import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger file uploads via proxy (100MB)
    proxyClientMaxBodySize: "100mb",
    // Also for server actions
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  images: {
    // Allow local uploads directory images
    // Using unoptimized for dynamic local paths from uploads
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
