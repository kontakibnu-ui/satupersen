import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { canAddMaterial } from "@/lib/study/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MaterialForm } from "../material-form";
import { BookDraftForm } from "./book-draft-form";

export const metadata: Metadata = {
  title: "Materi baru · Satu Persen",
};

/**
 * Adding a material (LEARN-1). A free account that already made its one
 * material sees the plan note instead of a form it could not send (LEARN-5);
 * the database refuses the insert either way.
 */
export default async function NewMaterialPage({
  searchParams,
}: {
  /** `dari=buku` when "Jadikan materi" in the reader opened this page (READ-7). */
  searchParams: Promise<{ dari?: string }>;
}) {
  const { dari } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, study_materials_created")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const canAdd = canAddMaterial(
    profile?.plan === "premium" ? "premium" : "free",
    Number(profile?.study_materials_created ?? 0),
  );

  return (
    <main className="py-6 md:py-10">
      <PageHeader
        eyebrow={
          <Link href="/learn" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text">
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
            Belajar
          </Link>
        }
        title="Materi baru"
      />

      {canAdd ? (
        dari === "buku" ? <BookDraftForm /> : <MaterialForm />
      ) : (
        <Card as="div" className="mt-6">
          <p className="text-base text-text">Paket gratis memuat 1 materi, dan kamu sudah memakainya.</p>
          <p className="mt-2 text-base text-text-muted">Materi tanpa batas ada di Premium.</p>
          <Link href="/settings/plan" className={buttonVariants({ variant: "secondary", className: "mt-5" })}>
            Lihat paket
          </Link>
        </Card>
      )}
    </main>
  );
}
