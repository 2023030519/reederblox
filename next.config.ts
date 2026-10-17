import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One value per deploy, baked into client and server alike; locally it stays "dev" so no update notice shows.
  env: { NEXT_PUBLIC_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
