import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  output: "export",
  transpilePackages: ["@atlas/pricing-core"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
