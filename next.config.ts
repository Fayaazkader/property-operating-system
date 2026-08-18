import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./lib/mocks/canvas.cjs",
    },
  },
};

export default nextConfig;
