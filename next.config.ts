import type { NextConfig } from "next";

// Packages that are large and NOT needed inside any Vercel serverless function.
// Excluding them prevents the 250 MB unzipped limit from being exceeded.
const HEAVY_EXCLUDES = [
  // Playwright / browser automation – pulled in by @langchain/community but never used server-side
  "./node_modules/@playwright/**/*",
  "./node_modules/playwright/**/*",
  "./node_modules/playwright-core/**/*",
  // Stagehand / browserbase – optional LangChain integrations, not used at runtime
  "./node_modules/@browserbasehq/**/*",
  // msw – mock service worker, dev-only
  "./node_modules/msw/**/*",
  // esbuild native binaries – not needed since we use ts.transpileModule
  "./node_modules/esbuild/**/*",
  "./node_modules/@esbuild/**/*",
  // Sharp – image processing, not used
  "./node_modules/sharp/**/*",
  // LangChain community optional heavy integrations
  "./node_modules/@xenova/**/*",
  "./node_modules/onnxruntime-node/**/*",
  "./node_modules/faiss-node/**/*",
  "./node_modules/canvas/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Bundle TypeScript compiler for in-process TS transpilation at runtime.
    "/api/execute": ["./node_modules/typescript/**/*"],
  },
  outputFileTracingExcludes: {
    // Apply exclusions to every route
    "*": HEAVY_EXCLUDES,
  },
};

export default nextConfig;
