import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
