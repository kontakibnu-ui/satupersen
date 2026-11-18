import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import { WhatsAppPanel } from "./whatsapp-panel";

export const metadata: Metadata = {
  title: "WhatsApp · Satu Persen",
};

/**
 * WhatsApp (PRD.md §6): link a number, and switch the automatic replies on or
 * off. Only the last four digits of a linked number are shown. Whether the
 * server is set up for WhatsApp decides which of the two screens appears; the
 * keys themselves never leave the server.
 */
export default async function WhatsAppSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: link, error } = await supabase
    .from("whatsapp_links")
    .select("phone, opted_in, verified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Data WhatsApp tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const linked = link?.verified_at ? { lastDigits: String(link.phone).slice(-4), optedIn: Boolean(link.opted_in) } : null;

  return (
    <main className="py-6 md:py-10">
      <PageHeader
        eyebrow={
          <Link href="/settings" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
            Akun
          </Link>
        }
        title="WhatsApp"
        description="Ceritakan harimu lewat chat, seperti ngobrol. Setiap pesan masuk ke diary hari itu dan dibalas singkat."
      />

      {linked === null && !isWhatsAppConfigured() ? (
        <p className="mt-6 rounded-[14px] border border-border bg-surface p-[18px] text-base text-text md:p-6">
          WhatsApp belum dikonfigurasi di server ini, jadi nomor belum bisa dihubungkan. Hubungi
          pengelola aplikasi.
        </p>
      ) : (
        <WhatsAppPanel linked={linked} />
      )}
    </main>
  );
}
