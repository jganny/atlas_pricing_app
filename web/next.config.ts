import type { NextConfig } from "next";

// The demo build is hosted at the root of its own Firebase Hosting site
// (vertex-35d95-demo), not nested under /app alongside the legacy app the
// way the real deployment is — so it needs no basePath.
const isDemoBuild = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const nextConfig: NextConfig = {
  basePath: isDemoBuild ? "" : "/app",
  output: "export",
  transpilePackages: ["@atlas/pricing-core", "three", "@react-three/fiber", "@react-three/drei"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Allow Cursor Preview / local IP to load HMR assets in development.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
