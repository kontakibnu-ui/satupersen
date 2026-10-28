import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

const PUBLIC_PATHS = ["/", "/login", "/privacy", "/terms", "/auth/callback"];

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

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({ request });

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

  return response;
}

export const config = {
  matcher: [
    // Static assets and the dev-only hot reload sockets never need a session
    // check; letting them through keeps the client bundle and HMR working.
    "/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
