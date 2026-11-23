import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { BOOK_FORMATS, type BookFormat } from "@/lib/books/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Reader } from "./reader";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Ruang baca · Satu Persen",
};

type BookRow = {
  id: string;
  title: string;
  format: BookFormat;
  size_bytes: number;
  storage_path: string;
  status: "uploading" | "ready";
  location: string | null;
  progress: number | string | null;
};

/**
 * The Ruang baca reader (PRD.md READ-3 to READ-9; DESIGN.md §6 "Pembaca").
 * Outside the (app) group on purpose: a full screen page without the app's
 * header and navigation, loaded as a new document so src/proxy.ts can give it
 * its own nonce policy (READ-8).
 *
 * The book is read with the user's session, so row level security answers
 * "not found" for anyone else's id; the file itself is fetched by the browser
 * with the same session and the Storage policy decides again.
 */
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const parsedId = z.uuid().safeParse(id);
  const [bookResult, profileResult] = parsedId.success
    ? await Promise.all([
        supabase
          .from("books")
          .select("id, title, format, size_bytes, storage_path, status, location, progress")
          .eq("id", parsedId.data)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      ])
    : [{ data: null, error: null }, { data: null, error: null }];

  if (bookResult.error || profileResult.error) {
    throw new Error("Buku tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const row = bookResult.data as BookRow | null;

  if (!row || row.status !== "ready" || !(BOOK_FORMATS as readonly string[]).includes(row.format)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-bold text-text">Buku ini tidak ada, atau sudah dihapus.</h1>
        <Link href="/learn" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">
          Kembali ke Belajar
        </Link>
      </main>
    );
  }

  return (
    <Reader
      userId={userId}
      isFree={profileResult.data?.plan !== "premium"}
      book={{
        id: row.id,
        title: row.title,
        format: row.format,
        sizeBytes: Number(row.size_bytes),
        storagePath: row.storage_path,
        location: row.location,
        progress: row.progress === null ? null : Number(row.progress),
      }}
    />
  );
}
