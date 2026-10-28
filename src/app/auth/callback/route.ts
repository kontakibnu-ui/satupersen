import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Landing point for both login flows: Google and the magic link email send the
 * user here with a code that is exchanged for a session (AUTH-1).
 */
/**
 * The redirect target is built from the Host header, not from request.url:
 * `next dev` rewrites request.url to its own canonical host (localhost) even
 * when the browser used 127.0.0.1, and a redirect to the other host would drop
 * the session cookies. Behind a proxy (Vercel) the forwarded headers win.
 */
function resolveOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!host) {
    return new URL(request.url).origin;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveOrigin(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/settings";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?status=gagal`);
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?status=gagal`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
