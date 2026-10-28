"use client";

import { useActionState, useSyncExternalStore } from "react";
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
  return completeOnboarding(formData);
}

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(submit, null);
  const timezone = useSyncExternalStore(subscribeNever, readTimezone, readTimezoneOnServer);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="timezone" value={timezone} />

      {/* The label is the touch target and is at least 44 px tall; the visible
          box stays 24 px, the same pattern DESIGN.md §6 uses for habit rows. */}
      <label className="flex min-h-11 items-start gap-3 py-1 text-base text-text">
        <input
          type="checkbox"
          name="privacy"
          value="set"
          className="mt-1 h-6 w-6 shrink-0 rounded-sm border border-control"
        />
        <span>Saya setuju dengan kebijakan privasi, termasuk bahwa isi catatan saya diproses oleh penyedia model AI untuk membuat ringkasan.</span>
      </label>

      <label className="flex min-h-11 items-start gap-3 py-1 text-base text-text">
        <input
          type="checkbox"
          name="age"
          value="set"
          className="mt-1 h-6 w-6 shrink-0 rounded-sm border border-control"
        />
        <span>Saya berusia 18 tahun ke atas.</span>
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md bg-primary px-5 text-base text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Mulai"}
        </button>

        {state?.message ? (
          <p role="status" className="text-sm text-text-muted">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
