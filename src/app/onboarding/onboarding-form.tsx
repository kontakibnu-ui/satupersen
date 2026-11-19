"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { completeOnboarding, type OnboardingResult } from "./actions";

/**
 * AUTH-3: only the browser knows the zone, and Asia/Jakarta stays the fallback
 * in the database when detection produces nothing usable. useSyncExternalStore
 * is used instead of an effect because writing state from an effect body is
 * both a lint error here and a needless extra render; React reads the server
 * snapshot during hydration and the real value right after.
 */
const subscribeNever = () => () => {};
const readTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
const readTimezoneOnServer = () => "";

async function submit(
  _previous: OnboardingResult | null,
  formData: FormData,
): Promise<OnboardingResult> {
  return callAction(() => completeOnboarding(formData));
}

/**
 * AUTH-4 (user decision 2026-11-19): no checkbox. One quiet sentence under the
 * button says that pressing it accepts the privacy policy, with a link to the
 * policy, which still explains what is sent to the model provider.
 */
export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(submit, null);
  const timezone = useSyncExternalStore(subscribeNever, readTimezone, readTimezoneOnServer);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="timezone" value={timezone} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyiapkan…" : "Mulai"}
      </Button>

      <p className="text-sm text-text-muted">
        Dengan menekan Mulai, kamu setuju dengan{" "}
        <Link
          href="/privacy"
          className="text-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Kebijakan Privasi
        </Link>
        .
      </p>

      {state?.message ? (
        <p role="status" className="text-sm text-text-muted">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
