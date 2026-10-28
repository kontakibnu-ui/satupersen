import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components is off on purpose. Every screen here reads the session
   * cookie (src/app/(app)/layout.tsx), so with it enabled Next.js requires a
   * Suspense boundary around each of those reads during prerendering, and the
   * build fails on routes like /login and /settings. The app is per user by
   * nature; nothing is prerendered for everyone.
   */
  cacheComponents: false,
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
