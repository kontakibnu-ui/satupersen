import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/redirects";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Landing point for the flows that leave the app: Google, the link in the
 * sign-up confirmation email, and the link in the password reset email
 * (`next=/reset-password`, AUTH-5) send the user here with a code that is
 * exchanged for a session (AUTH-1).
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
  // `next` is glued after the origin, so anything but an in-app path ("@evil.com") would leave the site.
  const next = safeNextPath(searchParams.get("next"));

  // A reset link that cannot be exchanged (expired, used, other browser) goes to
  // /reset-password, which explains that and offers a new link; the login form would not.
  const failed = next === "/reset-password" ? `${origin}/reset-password` : `${origin}/login?status=gagal`;

  if (!code) {
    return NextResponse.redirect(failed);
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(failed);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
