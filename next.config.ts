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

  /**
   * Playwright talks to the dev server over http://127.0.0.1:3000, because the
   * local Supabase stack only allows magic link redirects back to that host
   * (site_url in supabase/config.toml). Next.js 16 blocks dev resources for
   * origins it does not know, which silently stops the client bundle from
   * loading and leaves the page unhydrated, so the host is allowed here.
   */
  allowedDevOrigins: ["127.0.0.1"],
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
