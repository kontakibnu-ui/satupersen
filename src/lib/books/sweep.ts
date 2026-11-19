import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Book files whose owner is gone (PRD.md §7: deleting an account deletes
 * everything stored for it).
 *
 * "Hapus akun" in the app empties the user's folder before it deletes the
 * account. An account removed another way, such as from the Supabase dashboard
 * while answering a deletion request sent to the contact email, takes every
 * row with it through ON DELETE CASCADE but leaves the files, because Storage
 * objects are not reached by that cascade. The scheduled tick finds those
 * folders and empties them.
 *
 * Deleting is the dangerous direction, so a folder is only emptied when it is
 * named like a user id, has no profile, and Supabase Auth confirms there is no
 * such user. Any lookup that fails stops the sweep instead of guessing.
 */

export const BOOKS_BUCKET = "books";

/** Page size of a Storage folder listing. */
const STORAGE_PAGE = 1000;
/** Ids per profiles query, to keep the request URL short. */
const ID_CHUNK = 200;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Folder names that look like user ids and have no profile. */
export function orphanCandidates(folders: readonly string[], withProfile: ReadonlySet<string>): string[] {
  return folders.filter((name) => USER_ID.test(name) && !withProfile.has(name));
}

/**
 * Deletes every file in the user's folder of the books bucket, including files
 * whose row is already gone. Returns false when Storage refuses, so the caller
 * can stop rather than leave files without an owner.
 */
export async function removeBookFiles(admin: SupabaseClient, userId: string): Promise<boolean> {
  for (;;) {
    const { data: files, error: listError } = await admin.storage.from(BOOKS_BUCKET).list(userId, { limit: STORAGE_PAGE });

    if (listError) {
      console.error("listing book files failed", { userId, kind: listError.name });
      return false;
    }

    if (!files || files.length === 0) {
      return true;
    }

    const { error: removeError } = await admin.storage
      .from(BOOKS_BUCKET)
      .remove(files.map((file) => `${userId}/${file.name}`));

    if (removeError) {
      console.error("deleting book files failed", { userId, kind: removeError.name });
      return false;
    }
  }
}

export type SweepResult = { folders: number; emptied: number; failed: boolean };

export async function sweepOrphanBookFiles(admin: SupabaseClient): Promise<SweepResult> {
  const stop = (folders: number, emptied: number): SweepResult => ({ folders, emptied, failed: true });
  const folders: string[] = [];

  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const { data, error } = await admin.storage.from(BOOKS_BUCKET).list("", { limit: STORAGE_PAGE, offset });

    if (error) {
      console.error("listing book folders failed", { kind: error.name });
      return stop(0, 0);
    }

    // At the top of the bucket, entries without an id are folders (one per user).
    folders.push(...(data ?? []).filter((entry) => !entry.id).map((entry) => entry.name));

    if (!data || data.length < STORAGE_PAGE) {
      break;
    }
  }

  const ids = folders.filter((name) => USER_ID.test(name));
  const withProfile = new Set<string>();

  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .in("id", ids.slice(start, start + ID_CHUNK));

    if (error) {
      console.error("reading profiles for the book sweep failed", { code: error.code });
      return stop(folders.length, 0);
    }

    for (const row of data ?? []) {
      withProfile.add(row.id as string);
    }
  }

  let emptied = 0;

  for (const userId of orphanCandidates(folders, withProfile)) {
    const { data, error } = await admin.auth.admin.getUserById(userId);

    // A user that still exists is never swept, profile or not.
    if (data?.user) {
      continue;
    }

    if (error && error.status !== 404) {
      console.error("checking a book folder's owner failed", { userId, status: error.status });
      return stop(folders.length, emptied);
    }

    if (!(await removeBookFiles(admin, userId))) {
      return stop(folders.length, emptied);
    }

    emptied += 1;
  }

  return { folders: folders.length, emptied, failed: false };
}
