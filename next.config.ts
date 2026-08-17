import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: path.resolve(process.cwd(), "lib/mocks/canvas.js"),
    },
  },
};

export default nextConfig;
