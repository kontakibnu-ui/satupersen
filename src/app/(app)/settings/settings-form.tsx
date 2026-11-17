"use client";

import { ChevronRight, Gem, LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, Chip, IconBadge } from "@/components/ui/card";
import { forgetAllBooks } from "@/lib/books/cache";
import { AccountData } from "./account-data";
import { signOut, updateProfile, type ProfileActionResult } from "./actions";

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
  const zones = useSyncExternalStore(subscribeNever, readZones, readZonesOnServer);
  // The saved zone is always an option, even before the browser list arrives,
  // so the field never shows (and never saves) a zone the user did not pick.
  const zoneOptions = zones.includes(timezone) ? zones : [timezone, ...zones];

  const initial = (name.trim()[0] ?? email.trim()[0] ?? "S").toUpperCase();

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card aria-label="Profil">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-2xl font-medium text-primary-foreground"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text">{name || "Tanpa nama"}</p>
            <p className="truncate text-sm text-text-muted">Email: {email}</p>
          </div>
          <Chip tone={plan === "premium" ? "accent" : "neutral"} className="ml-auto shrink-0">
            Paket: {plan === "premium" ? "Premium" : "Gratis"}
          </Chip>
        </div>

        <form action={formAction} className="mt-6 flex flex-col gap-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-muted">
              Nama
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name}
              autoComplete="name"
              className="mt-1 min-h-12 w-full rounded-2xl border border-control bg-surface px-4 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-text-muted">
              Timezone
            </label>
            <select
              // A new key once the full list arrives, so defaultValue applies to the real options.
              key={zoneOptions.length}
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              className="mt-1 min-h-12 w-full rounded-2xl border border-control bg-surface px-4 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-text-muted">Hari baru dimulai mengikuti timezone ini.</p>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>

            {state?.message ? (
              <p role="status" className="text-sm text-text-muted">
                {state.message}
              </p>
            ) : null}
          </div>
        </form>
      </Card>

      <Card as="div" className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-serif text-xl font-medium text-text">Mode malam</p>
          <p className="mt-0.5 text-sm text-text-muted">Bawaannya mode siang. Pilihanmu diingat di browser ini.</p>
        </div>
        <ThemeToggle />
      </Card>

      <nav aria-label="Pengaturan lain" className="flex flex-col gap-4">
        <Link
          href="/settings/plan"
          className="flex min-h-11 items-center gap-4 rounded-3xl border border-border bg-surface p-5 transition-colors duration-200 hover:bg-surface-muted"
        >
          <IconBadge icon={Gem} tone="accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-text">Paket</span>
            <span className="block text-sm text-text-muted">Kuota AI bulan ini dan pilihan premium</span>
          </span>
          <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="text-text-muted" />
        </Link>
        <Link
          href="/settings/whatsapp"
          className="flex min-h-11 items-center gap-4 rounded-3xl border border-border bg-surface p-5 transition-colors duration-200 hover:bg-surface-muted"
        >
          <IconBadge icon={MessageCircle} tone="primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-text">WhatsApp</span>
            <span className="block text-sm text-text-muted">Curhat lewat chat, masuk ke diary</span>
          </span>
          <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="text-text-muted" />
        </Link>
      </nav>

      <Card as="div" className="flex flex-col gap-2">
        {/* Book copies kept for Ruang baca go before the session does (READ-9). */}
        <form
          action={async () => {
            await forgetAllBooks();
            await signOut();
          }}
        >
          <Button type="submit" variant="secondary" className="w-full">
            <LogOut aria-hidden="true" size={18} strokeWidth={2} />
            Keluar
          </Button>
        </form>

        <AccountData />
      </Card>
    </div>
  );
}
