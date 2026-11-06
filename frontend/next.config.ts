import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep development files apart from production builds so `next build` can run
  // while the local dev server is open on Windows.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next-production",
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8001";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
