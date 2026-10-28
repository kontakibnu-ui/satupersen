"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { signOut, updateProfile, type ProfileActionResult } from "./actions";

/**
 * Theme is a display preference, not user data: it lives in localStorage and is
 * applied to <html> as the light/dark class that globals.css understands
 * ("system" removes both, so the system preference decides). No column is added
 * to the database for it, because PRD.md §9 locks the table shape.
 *
 * Reading it goes through a tiny external store so React can tell the server
 * snapshot ("system") apart from the real client value without setting state
 * inside an effect.
 */
const THEME_KEY = "satupersen-theme";

type ThemeChoice = "system" | "light" | "dark";

const THEME_LABELS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
];

const EMPTY_ZONES: string[] = [];

const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);

  return () => {
    themeListeners.delete(listener);
  };
}

function readTheme(): ThemeChoice {
  const stored = window.localStorage.getItem(THEME_KEY);

  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

const readThemeOnServer = (): ThemeChoice => "system";

function writeTheme(next: ThemeChoice): void {
  window.localStorage.setItem(THEME_KEY, next);
  themeListeners.forEach((listener) => listener());
}

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

function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  if (choice !== "system") {
    root.classList.add(choice);
  }
}

async function submitProfile(
  _previous: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  return updateProfile(formData);
}

export function SettingsForm({
  name,
  timezone,
  plan,
  email,
}: {
  name: string;
  timezone: string;
  plan: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(submitProfile, null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readThemeOnServer);
  const zones = useSyncExternalStore(subscribeNever, readZones, readZonesOnServer);
  const zoneOptions = zones.length === 0 || zones.includes(timezone) ? zones : [timezone, ...zones];

  // Touching the DOM is exactly what effects are for; no state is written here.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function changeTheme(next: ThemeChoice): void {
    writeTheme(next);
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-6">
        <div>
          <label htmlFor="name" className="block text-sm text-text-muted">
            Nama
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={name}
            autoComplete="name"
            className="mt-1 h-11 w-full rounded-md border border-control bg-surface px-3 text-base text-text"
          />
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm text-text-muted">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={timezone}
            className="mt-1 h-11 w-full rounded-md border border-control bg-surface px-3 text-base text-text"
          >
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-text-muted">
            Hari baru dimulai mengikuti timezone ini.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-md border border-control px-4 text-base text-text disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>

          {state?.message ? (
            <p role="status" className="text-sm text-text-muted">
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <fieldset>
        <legend className="text-sm text-text-muted">Tema</legend>
        <div className="mt-2 flex gap-2">
          {THEME_LABELS.map((option) => (
            <label
              key={option.value}
              className={`flex h-11 items-center rounded-full border px-4 text-base ${
                theme === option.value
                  ? "border-control bg-primary-soft text-text"
                  : "border-control text-text-muted"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => changeTheme(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="text-sm text-text-muted">
        <p>Email: {email}</p>
        <p>Paket: {plan === "premium" ? "Premium" : "Gratis"}</p>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="h-11 rounded-md border border-control px-4 text-base text-text"
        >
          Keluar
        </button>
      </form>
    </div>
  );
}
