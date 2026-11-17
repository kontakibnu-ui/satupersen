"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOK_FORMATS, MAX_BOOK_BYTES, titleFromFileName } from "@/lib/books/rules";
import { getActionContext, type ActionContext } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Ruang baca (PRD.md READ-2, READ-10).
 *
 * A file goes from the phone straight to Supabase Storage, because a Vercel
 * Function takes at most 4.5 MB per request. The server hands out a one-time
 * upload permission after the plan check, then reads the size of the file that
 * actually arrived before the book counts. The plan, the user, and the quota
 * are always read on the server; the database repeats the limits under a per
 * user lock (start_book_upload, finish_book_upload).
 *
 * Book titles and contents are never logged: only ids and the class of a failure.
 */

type Failure = { ok: false; message: string };

const BUCKET = "books";
const SESSION_ENDED = "Sesi kamu sudah berakhir. Masuk lagi dulu.";
const GENERIC_FAILURE = "Buku belum berhasil diunggah. Coba lagi sebentar lagi.";
const NOT_FOUND = "Buku ini tidak ditemukan. Mungkin sudah dihapus.";
const LIMIT = "Paket gratis memuat 1 buku. Buku lebih banyak ada di Premium.";
const STORAGE_FULL = "Ruang bukumu sudah penuh (2 GB). Hapus buku yang sudah selesai dulu.";
const TOO_LARGE = "Ukuran file maksimal 50 MB.";

const fail = (message: string): Failure => ({ ok: false, message });

const startSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  format: z.enum(BOOK_FORMATS),
  size: z.number().int().min(1, TOO_LARGE).max(MAX_BOOK_BYTES, TOO_LARGE),
});

const bookIdSchema = z.object({ bookId: z.uuid() });

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Removes the file and the row of books that never finished uploading. */
async function discardUploads(admin: Admin, userId: string, rows: { id: string; storage_path: string }[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error: storageError } = await admin.storage.from(BUCKET).remove(rows.map((row) => row.storage_path));

  if (storageError) {
    console.error("discarding unfinished book files failed", { userId, kind: storageError.name });
  }

  const { error } = await admin
    .from("books")
    .delete()
    .eq("user_id", userId)
    .in(
      "id",
      rows.map((row) => row.id),
    );

  if (error) {
    console.error("discarding unfinished book rows failed", { userId, code: error.code });
  }
}

function refresh(): void {
  revalidatePath("/learn");
}

/**
 * Step 1 of an upload. Unfinished uploads of this user are thrown away first,
 * so an upload that broke off never keeps the free slot. Returns where to put
 * the file and the one-time permission for it.
 */
export async function startBookUpload(input: {
  fileName: string;
  format: string;
  size: number;
}): Promise<{ ok: true; bookId: string; path: string; token: string } | Failure> {
  const parsed = startSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message === TOO_LARGE ? TOO_LARGE : "File ini tidak bisa diunggah.");
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const admin = createSupabaseAdminClient();
  const { data: unfinished, error: readError } = await admin
    .from("books")
    .select("id, storage_path")
    .eq("user_id", context.userId)
    .eq("status", "uploading");

  if (readError) {
    console.error("reading unfinished uploads failed", { userId: context.userId, code: readError.code });
    return fail(GENERIC_FAILURE);
  }

  await discardUploads(admin, context.userId, unfinished ?? []);

  const { data: bookId, error: startError } = await admin.rpc("start_book_upload", {
    p_user: context.userId,
    p_title: titleFromFileName(parsed.data.fileName),
    p_format: parsed.data.format,
    p_size: parsed.data.size,
  });

  if (startError || typeof bookId !== "string") {
    if (startError?.message.includes("book_limit_reached")) {
      return fail(LIMIT);
    }

    if (startError?.message.includes("book_storage_full")) {
      return fail(STORAGE_FULL);
    }

    console.error("starting a book upload failed", { userId: context.userId, code: startError?.code });
    return fail(GENERIC_FAILURE);
  }

  const path = `${context.userId}/${bookId}`;
  const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);

  if (signError || !signed) {
    console.error("creating an upload permission failed", { userId: context.userId, bookId });
    await discardUploads(admin, context.userId, [{ id: bookId, storage_path: path }]);
    return fail(GENERIC_FAILURE);
  }

  return { ok: true, bookId, path, token: signed.token };
}

async function ownBook(context: ActionContext, admin: Admin, bookId: string) {
  const { data, error } = await admin
    .from("books")
    .select("id, storage_path, status")
    .eq("id", bookId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    throw new Error("The book could not be read");
  }

  return data as { id: string; storage_path: string; status: "uploading" | "ready" } | null;
}

/**
 * Step 2 of an upload, after the phone has put the file in Storage. The size
 * comes from Storage itself, never from the browser; a file over the plan's room
 * is deleted together with its row.
 */
export async function finishBookUpload(input: { bookId: string }): Promise<{ ok: true } | Failure> {
  const parsed = bookIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail(NOT_FOUND);
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const admin = createSupabaseAdminClient();
  let book: Awaited<ReturnType<typeof ownBook>>;

  try {
    book = await ownBook(context, admin, parsed.data.bookId);
  } catch {
    console.error("reading a book to finish its upload failed", { userId: context.userId, bookId: parsed.data.bookId });
    return fail(GENERIC_FAILURE);
  }

  if (!book || book.status !== "uploading") {
    return fail("Unggahan ini sudah tidak berlaku. Coba unggah lagi.");
  }

  const { data: stored, error: infoError } = await admin.storage.from(BUCKET).info(book.storage_path);

  if (infoError || typeof stored?.size !== "number") {
    await discardUploads(admin, context.userId, [book]);
    return fail("File belum sampai. Coba unggah lagi.");
  }

  const { data: outcome, error: finishError } = await admin.rpc("finish_book_upload", {
    p_user: context.userId,
    p_book: book.id,
    p_size: stored.size,
  });

  if (finishError || outcome !== "ready") {
    if (finishError) {
      console.error("finishing a book upload failed", { userId: context.userId, bookId: book.id, code: finishError.code });
    }

    await discardUploads(admin, context.userId, [book]);

    switch (outcome) {
      case "too_large":
        return fail(TOO_LARGE);
      case "limit":
        return fail(LIMIT);
      case "storage_full":
        return fail(STORAGE_FULL);
      default:
        return fail(GENERIC_FAILURE);
    }
  }

  refresh();
  return { ok: true };
}

/** Deletes a book and its file (READ-10). On free, the slot does not come back. */
export async function deleteBook(input: { bookId: string }): Promise<{ ok: true } | Failure> {
  const parsed = bookIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail(NOT_FOUND);
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const admin = createSupabaseAdminClient();
  let book: Awaited<ReturnType<typeof ownBook>>;

  try {
    book = await ownBook(context, admin, parsed.data.bookId);
  } catch {
    console.error("reading a book to delete it failed", { userId: context.userId, bookId: parsed.data.bookId });
    return fail("Buku belum terhapus. Coba lagi sebentar lagi.");
  }

  if (!book) {
    return fail(NOT_FOUND);
  }

  // The file goes first: a row without a file only shows an error, while a file
  // without a row would stay in Storage with nothing pointing at it.
  const { error: storageError } = await admin.storage.from(BUCKET).remove([book.storage_path]);

  if (storageError) {
    console.error("deleting a book file failed", { userId: context.userId, bookId: book.id, kind: storageError.name });
    return fail("Buku belum terhapus. Coba lagi sebentar lagi.");
  }

  const { error } = await admin.from("books").delete().eq("id", book.id).eq("user_id", context.userId);

  if (error) {
    console.error("deleting a book row failed", { userId: context.userId, bookId: book.id, code: error.code });
    return fail("Buku belum terhapus. Coba lagi sebentar lagi.");
  }

  refresh();
  return { ok: true };
}
