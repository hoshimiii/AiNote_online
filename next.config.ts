import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle TypeScript compiler for in-process TS transpilation at runtime.
  // Required because tsx is no longer used; we call ts.transpileModule() directly.
  outputFileTracingIncludes: {
    "/api/execute": ["./node_modules/typescript/**/*"],
  },
};

export default nextConfig;
