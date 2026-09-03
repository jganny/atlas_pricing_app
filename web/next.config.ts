import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  output: "export",
  transpilePackages: ["@atlas/pricing-core"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Allow Cursor Preview / local IP to load HMR assets in development.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
