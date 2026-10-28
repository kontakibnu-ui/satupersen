import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Landing point for both login flows: Google and the magic link email send the
 * user here with a code that is exchanged for a session (AUTH-1).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
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
