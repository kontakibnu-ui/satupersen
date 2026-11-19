import { ChevronRight, Clock, Download, FileText, MessageCircle, ShieldCheck, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Chip } from "@/components/ui/card";
import { monthlyStanding } from "@/lib/ai/usage";
import { indonesianZoneName, isValidTimeZone } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import { AccountData } from "./account-data";
import { SettingsGroup, SettingsRow } from "./settings-row";

export const metadata: Metadata = {
  title: "Akun · Satu Persen",
};

/**
 * Akun as a menu (DESIGN.md §14.3 "Akun", user 2026-11-19: "layout menu akun
 * pada umumnya"): a profile card that opens Profil, then groups of rows in
 * plain cards, then Keluar and Hapus akun. It is also what the login flow lands
 * on. DESIGN.md §2 keeps it calm: no focus element, no primary button.
 */
export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const [{ data: profile, error }, { data: link, error: linkError }] = await Promise.all([
    supabase.from("profiles").select("name, timezone, plan").eq("id", userId).maybeSingle(),
    supabase.from("whatsapp_links").select("verified_at").eq("user_id", userId).maybeSingle(),
  ]);

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const email = claims?.claims?.email ?? "";
  const name = ((profile?.name as string | null) ?? "").trim();
  // The same letter as the profile circle in the header (app layout).
  const initial = (name[0] ?? email.trim()[0] ?? "S").toUpperCase();
  const plan = profile?.plan === "premium" ? "premium" : "free";
  const savedZone = profile?.timezone ?? "Asia/Jakarta";
  const timeZone = isValidTimeZone(savedZone) ? savedZone : "Asia/Jakarta";
  const standing = await monthlyStanding(supabase, userId, plan, timeZone);

  const quotaDetail = !standing.known
    ? "Kuota AI bulan ini belum bisa dibaca"
    : standing.overCap
      ? "Kuota AI bulan ini sudah habis"
      : `Kuota AI ${standing.percent}% terpakai bulan ini`;

  // A failed read of the link must not hide sign out and delete, so it is said in the row instead.
  const whatsappStatus = linkError
    ? "Belum terbaca"
    : link?.verified_at
      ? "Terhubung"
      : isWhatsAppConfigured()
        ? "Belum terhubung"
        : "Segera dibuka";

  return (
    <main className="py-6 md:py-10">
      <PageHeader title="Akun" />

      <Link
        href="/settings/profile"
        className="mt-6 flex items-center gap-3.5 rounded-[14px] border border-border bg-surface p-4 transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="sr-only">Profil: </span>
          <span className="block truncate text-base font-bold text-text">{name || email}</span>
          {name ? <span className="block truncate text-sm text-text-muted">{email}</span> : null}
        </span>
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-text-muted" />
      </Link>

      <div className="mt-7 flex flex-col gap-7">
        <SettingsGroup id="group-plan" title="Langganan">
          <SettingsRow
            href="/settings/plan"
            icon={Ticket}
            title="Paket"
            detail={quotaDetail}
            value={<Chip tone={plan === "premium" ? "primary" : "neutral"}>{plan === "premium" ? "Premium" : "Gratis"}</Chip>}
          >
            {standing.known ? (
              <span
                role="meter"
                aria-label="Kuota AI bulan ini"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={standing.percent}
                aria-valuetext={`${standing.percent}% terpakai`}
                className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
              >
                <span className="block h-full rounded-full bg-primary" style={{ width: `${standing.percent}%` }} />
              </span>
            ) : null}
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup id="group-settings" title="Pengaturan">
          <SettingsRow
            href="/settings/profile"
            icon={Clock}
            title="Zona waktu"
            value={indonesianZoneName(timeZone) ?? timeZone}
          />
          <SettingsRow href="/settings/whatsapp" icon={MessageCircle} title="WhatsApp" value={whatsappStatus} />
        </SettingsGroup>

        <SettingsGroup id="group-data" title="Data dan privasi">
          <SettingsRow href="/api/account/export" download icon={Download} title="Unduh semua datamu" value="JSON" />
          <SettingsRow href="/privacy" icon={ShieldCheck} title="Kebijakan privasi" />
          <SettingsRow href="/terms" icon={FileText} title="Syarat layanan" />
        </SettingsGroup>
      </div>

      <AccountData />
    </main>
  );
}
