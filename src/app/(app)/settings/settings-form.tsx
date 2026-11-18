"use client";

import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { SectionHead } from "@/components/notebook";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { forgetAllBooks } from "@/lib/books/cache";
import { cn } from "@/lib/utils";
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

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section aria-labelledby="profile-title">
        <SectionHead
          id="profile-title"
          title="Profil"
          aside={plan === "premium" ? "Paket premium" : "Paket gratis"}
        />

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-text">
              Nama
            </label>
            <Input id="name" name="name" type="text" defaultValue={name} autoComplete="name" className="mt-1.5" />
          </div>

          <div>
            <p className="text-sm font-semibold text-text">Email</p>
            <p className="mt-1.5 truncate text-base text-text-muted">{email}</p>
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-semibold text-text">
              Timezone
            </label>
            <select
              // A new key once the full list arrives, so defaultValue applies to the real options.
              key={zoneOptions.length}
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              aria-describedby="timezone-hint"
              className={cn(inputClassName, "mt-1.5")}
            >
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p id="timezone-hint" className="mt-1.5 text-sm text-text-muted">
              Hari baru dimulai mengikuti timezone ini.
            </p>
          </div>

          <Button type="submit" variant="secondary" disabled={pending} className="w-full sm:w-auto sm:self-start">
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>

          {state?.message ? (
            <p role="status" className="text-sm text-text-muted">
              {state.message}
            </p>
          ) : null}
        </form>
      </section>

      <section aria-labelledby="look-title">
        <SectionHead id="look-title" title="Tampilan" />
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-rule py-2">
          <div className="min-w-0">
            <p className="text-base text-text">Mode malam</p>
            <p className="text-sm text-text-muted">Bawaannya mode siang. Pilihanmu diingat di browser ini.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <nav aria-labelledby="more-title">
        <SectionHead id="more-title" title="Pengaturan lain" />
        <ul>
          <li className="border-b border-rule">
            <Link href="/settings/plan" className="flex min-h-14 items-center gap-3 py-2 hover:text-primary">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-text">Paket</span>
                <span className="block text-sm text-text-muted">Kuota AI bulan ini dan pilihan premium</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-text-muted" />
            </Link>
          </li>
          <li className="border-b border-rule">
            <Link href="/settings/whatsapp" className="flex min-h-14 items-center gap-3 py-2 hover:text-primary">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-text">WhatsApp</span>
                <span className="block text-sm text-text-muted">Curhat lewat chat, masuk ke diary</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-text-muted" />
            </Link>
          </li>
        </ul>
      </nav>

      <AccountData
        signOut={
          // Book copies kept for Ruang baca go before the session does (READ-9).
          <form
            action={async () => {
              await forgetAllBooks();
              await signOut();
            }}
          >
            <Button type="submit" variant="link" className="gap-2 text-sm font-semibold text-primary">
              <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
              Keluar
            </Button>
          </form>
        }
      />
    </div>
  );
}
