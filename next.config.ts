import type { NextConfig } from "next";
import { siteContentSecurityPolicy } from "./src/lib/csp";

const isProduction = process.env.NODE_ENV === "production";

/**
 * The address of the Supabase project, the only outside place the browser talks
 * to (login and session refresh). Read from the same public variable the client
 * uses, so a change of project needs no second edit.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";

/**
 * The site-wide Content-Security-Policy lives in src/lib/csp.ts (PRD.md §7,
 * point 6). The reader at /read/[id] gets it from src/proxy.ts instead,
 * together with its own nonce policy (READ-8), so it is left out here: two
 * sources writing the same header could drop one of the policies.
 */
const contentSecurityPolicy = siteContentSecurityPolicy({ isProduction, supabaseOrigin });

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Only over HTTPS, so it is sent in production alone.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  /**
   * Source maps stay off in production: anything that reaches the browser can be
   * read, and the original code should not be handed over with it (PRD.md §7,
   * point 5).
   */
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/((?!read/).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },

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
