import type { NextConfig } from "next";
import path from "path";

// Monorepo layout: this app lives in <repo>/client while the shared
// node_modules is hoisted to the workspace root by npm workspaces.
// Turbopack must be told where the real workspace root is.
const workspaceRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: workspaceRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
