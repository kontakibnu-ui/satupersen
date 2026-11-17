import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isReaderPath, readerContentSecurityPolicy, siteContentSecurityPolicy } from "@/lib/csp";

/**
 * Keeps the Supabase session fresh and keeps everything outside the public
 * pages behind a login (AUTH-2).
 *
 * Next.js 16 renamed the middleware convention to `proxy` (same behaviour, a
 * clearer name), which is why this file and its exported function are called
 * `proxy`. Token refreshes have to write cookies from here: pages and Server
 * Components cannot set cookies in Next.js, and @supabase/ssr documents that
 * this layer must handle it. The `headers` argument carries the no-store cache
 * headers that must travel with the new cookies.
 *
 * API routes are not redirected on purpose: /api/whatsapp/webhook and
 * /api/cron/tick are called by Meta and pg_cron without a session, so each
 * route checks its own signature or secret (AGENTS.md §6).
 */

/**
 * /reset-password is public on purpose: an expired or reused reset link arrives
 * there without a session, and the page itself explains how to ask for a new one
 * instead of bouncing the user to the login form.
 */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/manifest.webmanifest",
];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) {
    return true;
  }

  return PUBLIC_PATHS.some((path) => pathname === path);
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return new NextResponse(
      "Supabase belum dikonfigurasi, jadi kamu belum bisa masuk. Hubungi pengelola aplikasi.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  // The reader (READ-8) gets a fresh nonce on every request. Next.js reads it
  // from the request's policy header and puts it on its own scripts; the
  // response carries the site-wide policy and the nonce policy together.
  const isProduction = process.env.NODE_ENV === "production";
  const nonce = isReaderPath(request.nextUrl.pathname) ? btoa(crypto.randomUUID()) : null;
  const readerPolicy = nonce ? readerContentSecurityPolicy({ nonce, isProduction }) : null;

  const forward = () => {
    if (!nonce || !readerPolicy) {
      return NextResponse.next({ request });
    }

    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", readerPolicy);

    return NextResponse.next({ request: { headers } });
  };

  let response = forward();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = forward();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && !isPublicPath(pathname)) {
    // Built from the Host header: `next dev` canonicalises request.url to its
    // own host, and redirecting to another host would lose the session cookies.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    const origin = host ? `${proto}://${host}` : request.nextUrl.origin;

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (readerPolicy) {
    const sitePolicy = siteContentSecurityPolicy({ isProduction, supabaseOrigin: new URL(url).origin });
    // One header holding two policies, separated by a comma, is enforced like two
    // headers. The nonce policy goes first on purpose: Next.js copies the proxy's
    // response headers onto the request (server/lib/router-utils/resolve-routes.js)
    // and reads the nonce from the first script-src it finds in that value.
    response.headers.set("Content-Security-Policy", `${readerPolicy}, ${sitePolicy}`);
  }

  return response;
}

export const config = {
  matcher: [
    // Static assets and the dev-only hot reload sockets never need a session
    // check; letting them through keeps the client bundle and HMR working.
    // ocr/ is the screenshot reader's engine and language data, copied from
    // node_modules (scripts/copy-ocr-assets.mjs); reader/ is foliate-js and
    // PDF.js (scripts/copy-reader-assets.mjs). Neither holds user data.
    "/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr|favicon.ico|ocr/|reader/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
