import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray ~/yarn.lock otherwise makes Next infer the
  // home directory as the Turbopack root, breaking file resolution.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
