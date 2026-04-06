import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure tsx's dist is included in Vercel's serverless bundle.
  // Required because tsx is invoked via child_process.spawn at runtime
  // and Vercel's file tracer won't detect it automatically.
  outputFileTracingIncludes: {
    "/api/execute": ["./node_modules/tsx/**/*"],
  },
};

export default nextConfig;
