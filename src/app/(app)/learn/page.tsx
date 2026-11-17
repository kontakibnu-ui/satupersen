import { BookOpen, ChevronRight, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { isValidTimeZone, todayKey } from "@/lib/dates";
import { canAddMaterial } from "@/lib/study/limits";
import { materialState, reviewDayLabel, type MaterialState } from "@/lib/study/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookShelf, BookShelfUnavailable, type ShelfBook } from "./book-shelf";

export const metadata: Metadata = {
  title: "Belajar · Satu Persen",
};

type MaterialRow = { id: string; title: string; status: "draft" | "active" };

function statusLine(state: MaterialState, today: string): string {
  switch (state.kind) {
    case "draft":
      return "Belum diperiksa";
    case "due":
      return `${state.dueCount} pertanyaan menunggu hari ini`;
    case "waiting":
      return `Review berikutnya ${reviewDayLabel(state.nextDue, today)}`;
    case "finished":
      return "Selesai, semua pertanyaan sudah nempel";
  }
}

/**
 * Belajar (PRD.md LEARN-1, LEARN-5; DESIGN.md §2, §6, §8). The focus is "Review
 * hari ini" when something is due, otherwise the list of materials. "Tambah
 * materi" is the primary button only while there is no material; after that it
 * is a link, or the free plan's note when the one material is used.
 *
 * Everything is read with the user's session, so row level security keeps other
 * users out; "today" is the profile's local day.
 */
export default async function LearnPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const [profileResult, materialsResult, questionsResult, booksResult, bookCountResult] = await Promise.all([
    supabase.from("profiles").select("timezone, plan, study_materials_created").eq("id", userId).maybeSingle(),
    supabase
      .from("study_materials")
      .select("id, title, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("study_questions").select("material_id, due_date").eq("user_id", userId),
    supabase
      .from("books")
      .select("id, title, format, size_bytes, progress, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    // Read on its own, so the materials still load if Ruang baca's column is missing.
    supabase.from("profiles").select("books_created").eq("id", userId).maybeSingle(),
  ]);

  if (profileResult.error || materialsResult.error || questionsResult.error) {
    throw new Error("Materi belajar tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  // Ruang baca failing to load must not take the materials down with it.
  const shelfError = booksResult.error ?? bookCountResult.error;

  if (shelfError) {
    console.error("reading the books for Ruang baca failed", { userId, code: shelfError.code });
  }

  const bookRows = (booksResult.data ?? []) as {
    id: string;
    title: string;
    format: ShelfBook["format"];
    size_bytes: number;
    progress: number | string | null;
    status: "uploading" | "ready";
  }[];
  // Uploads in flight count against the room, as they do in the database (READ-2).
  const usedBookBytes = bookRows.reduce((sum, book) => sum + Number(book.size_bytes), 0);
  const shelf = shelfError ? (
    <BookShelfUnavailable />
  ) : (
    <BookShelf
      books={bookRows
        .filter((book) => book.status === "ready")
        .map((book) => ({
          id: book.id,
          title: book.title,
          format: book.format,
          sizeBytes: Number(book.size_bytes),
          progress: book.progress === null ? null : Number(book.progress),
        }))}
      plan={profileResult.data?.plan === "premium" ? "premium" : "free"}
      booksCreated={Number(bookCountResult.data?.books_created ?? 0)}
      usedBytes={usedBookBytes}
    />
  );

  const profile = profileResult.data;
  const timeZone = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const plan = profile?.plan === "premium" ? "premium" : "free";
  const today = todayKey(timeZone);
  const canAdd = canAddMaterial(plan, Number(profile?.study_materials_created ?? 0));

  const dueDatesByMaterial = new Map<string, (string | null)[]>();

  for (const question of questionsResult.data ?? []) {
    const list = dueDatesByMaterial.get(question.material_id as string) ?? [];
    list.push(question.due_date as string | null);
    dueDatesByMaterial.set(question.material_id as string, list);
  }

  const materials = ((materialsResult.data ?? []) as MaterialRow[]).map((material) => ({
    ...material,
    state: materialState(material.status, dueDatesByMaterial.get(material.id) ?? [], today),
  }));
  const due = materials.filter((material) => material.state.kind === "due");

  const addLink = canAdd ? (
    <Link href="/learn/new" className={buttonVariants({ variant: "link", className: "mt-2 font-semibold text-primary" })}>
      Tambah materi
    </Link>
  ) : (
    <p className="mt-4 text-sm text-text-muted">
      Paket gratis memuat 1 materi. Materi tanpa batas ada di Premium.{" "}
      <Link href="/settings/plan" className={buttonVariants({ variant: "link", size: "inline", className: "font-semibold text-primary" })}>
        Lihat paket
      </Link>
    </p>
  );

  return (
    <main className="py-6 md:py-10">
      <PageHeader title="Belajar" description="Biar materi nempel, bukan cuma lewat." />

      {materials.length === 0 ? (
        <Card as="div" className="mt-6">
          <CardHeader title="Cara kerjanya" icon={BookOpen} />
          <ol className="mt-4 flex flex-col gap-3">
            {[
              "Tempel bahan yang mau kamu pelajari.",
              "Jelaskan dengan kata sendiri tanpa melihat bahan. AI memeriksanya dari bahanmu.",
              "Jawab pertanyaan review dengan jarak yang makin panjang: 1, 3, 7, 14, lalu 30 hari.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-base text-text">
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {canAdd ? (
            <Link href="/learn/new" className={buttonVariants({ className: "mt-6 w-full sm:w-auto" })}>
              Tambah materi
            </Link>
          ) : (
            addLink
          )}
        </Card>
      ) : null}

      {materials.length === 0 ? (
        shelf
      ) : (
        <>
          {due.length > 0 ? (
            <Card className="mt-6" aria-labelledby="review-today">
              <CardHeader id="review-today" title="Review hari ini" icon={RotateCcw} />
              <MaterialLinks materials={due} today={today} hash="#review" />
            </Card>
          ) : null}

          <Card className="mt-4" aria-labelledby="my-materials">
            <CardHeader id="my-materials" title="Materimu" icon={BookOpen} />
            <MaterialLinks materials={materials} today={today} />
          </Card>

          {addLink}

          {shelf}
        </>
      )}
    </main>
  );
}

function MaterialLinks({
  materials,
  today,
  hash = "",
}: {
  materials: (MaterialRow & { state: MaterialState })[];
  today: string;
  hash?: string;
}) {
  return (
    <ul className="mt-2 flex flex-col">
      {materials.map((material) => (
        <li key={material.id} className="border-b border-border last:border-b-0">
          <Link
            href={`/learn/${material.id}${hash}`}
            className="-mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-text">{material.title}</span>
              <span className="block text-sm text-text-muted">{statusLine(material.state, today)}</span>
            </span>
            <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
