import type { NextConfig } from "next";

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
 * Content-Security-Policy (PRD.md §7, point 6). Next.js writes small inline
 * scripts into every page, so scripts allow 'unsafe-inline' for now; a policy
 * with per-request nonces is possible later and would tighten this one line.
 * Everything else is closed: no plugins, no framing, no other origin for
 * scripts, styles, fonts, images, or requests. The dev server needs eval and a
 * websocket for hot reload, which production never gets.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isProduction ? "" : " ws: wss:"}`.trimEnd(),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
    return [{ source: "/(.*)", headers: securityHeaders }];
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
