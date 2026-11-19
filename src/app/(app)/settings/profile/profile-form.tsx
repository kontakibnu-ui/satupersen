"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { callAction } from "@/lib/call-action";
import { formatClock, INDONESIAN_TIME_ZONES, indonesianZoneName } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { updateProfile, type ProfileActionResult } from "../actions";

const EMPTY_ZONES: string[] = [];

const subscribeNever = () => () => {};

let cachedZones: string[] | null = null;

/** The browser already knows every time zone, so no long constant is shipped. */
function readZones(): string[] {
  if (cachedZones === null) {
    const supportedValuesOf = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;

    cachedZones = supportedValuesOf ? supportedValuesOf("timeZone") : [];
  }

  return cachedZones;
}

const readZonesOnServer = (): string[] => EMPTY_ZONES;

/** The current minute, so the clock under the zone moves; null on the server, which has no user clock. */
function subscribeMinute(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
}

const readMinute = (): number => Math.floor(Date.now() / 60_000);

const readMinuteOnServer = (): number | null => null;

const zoneOptionLabel = (zone: string): string => {
  const name = indonesianZoneName(zone);
  return name ? `${zone} (${name})` : zone;
};

async function submitProfile(
  _previous: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  return callAction(() => updateProfile(formData));
}

/**
 * The form of Profil (DESIGN.md §14.3 "Akun"): name and time zone, saved with
 * one secondary button. Indonesia's zones come first with their usual names,
 * and the hint under the zone shows the time there now, so a wrong pick is
 * easy to spot before a day starts at the wrong midnight (AUTH-3).
 */
export function ProfileForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, formAction, pending] = useActionState(submitProfile, null);
  const [zone, setZone] = useState(timezone);
  const zones = useSyncExternalStore(subscribeNever, readZones, readZonesOnServer);
  const minute = useSyncExternalStore(subscribeMinute, readMinute, readMinuteOnServer);

  // The saved zone is always an option, even before the browser list arrives,
  // so the field never shows (and never saves) a zone the user did not pick.
  const otherZones = (zones.includes(timezone) ? zones : [timezone, ...zones]).filter(
    (option) => !INDONESIAN_TIME_ZONES.includes(option),
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-text">
          Nama
        </label>
        <Input id="name" name="name" type="text" defaultValue={name} autoComplete="name" className="mt-1.5" />
      </div>

      <div>
        <label htmlFor="timezone" className="block text-sm font-semibold text-text">
          Zona waktu
        </label>
        <select
          id="timezone"
          name="timezone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          aria-describedby="timezone-hint"
          className={cn(inputClassName, "mt-1.5")}
        >
          <optgroup label="Indonesia">
            {INDONESIAN_TIME_ZONES.map((option) => (
              <option key={option} value={option}>
                {zoneOptionLabel(option)}
              </option>
            ))}
          </optgroup>
          {otherZones.length > 0 ? (
            <optgroup label="Zona lain">
              {otherZones.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <p id="timezone-hint" className="mt-1.5 text-sm text-text-muted">
          {minute === null
            ? "Hari baru dimulai pukul 00.00 di zona ini."
            : `Sekarang pukul ${formatClock(zone, new Date(minute * 60_000))} di zona ini. Hari baru dimulai pukul 00.00.`}
        </p>
      </div>

      <Button type="submit" variant="secondary" disabled={pending} className="mt-2 w-full">
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {state?.message}
      </p>
    </form>
  );
}
