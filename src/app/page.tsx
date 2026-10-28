import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The landing page is its own task (LAUNCH, TASKS.md 6.4) and will live here.
 * Until then this route must not show scaffold text, so it sends people to the
 * app when they are signed in and to the login screen when they are not.
 */
export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  redirect(data?.claims?.sub ? "/today" : "/login");
}
