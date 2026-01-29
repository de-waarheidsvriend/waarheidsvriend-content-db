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
};

export default nextConfig;
