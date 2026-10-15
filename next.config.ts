import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/execution/pdf-worker': ['./node_modules/pdfjs-dist/build/pdf.worker.min.js'],
  },
};

export default nextConfig;
