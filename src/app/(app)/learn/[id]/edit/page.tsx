import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MaterialForm } from "../../material-form";

export const metadata: Metadata = {
  title: "Ubah bahan · Satu Persen",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fixing a draft's title and material (LEARN-2). Once the material has been
 * checked its questions come from that text, so it can no longer change; the
 * database refuses it too (study_source_locked).
 */
export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: material, error } = UUID_PATTERN.test(id)
    ? await supabase
        .from("study_materials")
        .select("id, title, source, status")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };

  if (error) {
    throw new Error("Materi tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const backHref = material ? `/learn/${material.id}` : "/learn";

  return (
    <main className="py-6 md:py-10">
      <PageHeader
        eyebrow={
          <Link href={backHref} className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text">
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
            {material ? (material.title as string) : "Belajar"}
          </Link>
        }
        title="Ubah bahan"
      />

      {!material ? (
        <Card as="div" className="mt-6">
          <p className="text-base text-text">Materi ini tidak ada, atau sudah dihapus.</p>
          <Link href="/learn" className={buttonVariants({ variant: "secondary", className: "mt-5" })}>
            Kembali ke Belajar
          </Link>
        </Card>
      ) : material.status === "active" ? (
        <Card as="div" className="mt-6">
          <p className="text-base text-text">
            Bahan tidak bisa diubah setelah diperiksa, karena pertanyaan reviewnya dibuat dari bahan itu.
          </p>
          <Link href={backHref} className={buttonVariants({ variant: "secondary", className: "mt-5" })}>
            Kembali ke materi
          </Link>
        </Card>
      ) : (
        <MaterialForm
          material={{ id: material.id as string, title: material.title as string, source: material.source as string }}
        />
      )}
    </main>
  );
}
