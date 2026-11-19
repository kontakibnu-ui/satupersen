import { z } from "zod";

/**
 * Diary text that has not reached the server yet, kept in this browser's
 * localStorage (user decision 2026-11-18), so a dropped connection, a closed
 * tab, or a quick tap to another screen does not lose it.
 *
 * - One key per user and date, so a shared browser never shows one account's
 *   text to another and a draft never pours into another day.
 * - `base` is the text the server had when the draft was written. The draft is
 *   put back on its own only while the server still has exactly that; when the
 *   text was changed elsewhere in the meantime, the user chooses.
 * - It goes once the server has the same text, when Hari Ini opens on another
 *   day (the server only accepts today, so an older day's draft can never be
 *   sent), when another account opens Hari Ini in this browser, and on sign out
 *   and account deletion.
 *
 * localStorage can be missing or refuse (private mode, full, blocked). Every
 * helper then reports that, and the editor keeps saving straight to the server.
 */

const PREFIX = "satupersen-entry-draft:";

const draftSchema = z.object({ content: z.string(), base: z.string() });

export type EntryDraft = z.infer<typeof draftSchema>;

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export type DraftResolution =
  /** Nothing kept here: show the server text. */
  | { kind: "none" }
  /** The server already has this text: drop the copy. */
  | { kind: "discard" }
  /** The server text is still what the draft started from: carry on with the draft. */
  | { kind: "restore"; content: string }
  /** The server text changed elsewhere after the draft was written: ask. */
  | { kind: "conflict"; content: string };

export const draftKey = (userId: string, date: string) => `${PREFIX}${userId}:${date}`;

export function resolveEntryDraft(serverContent: string, draft: EntryDraft | null): DraftResolution {
  if (!draft) {
    return { kind: "none" };
  }

  if (draft.content === serverContent) {
    return { kind: "discard" };
  }

  if (draft.base === serverContent) {
    return { kind: "restore", content: draft.content };
  }

  return { kind: "conflict", content: draft.content };
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Some browsers throw on the getter itself when site data is blocked: no storage.
    return null;
  }
}

export function readEntryDraft(
  userId: string,
  date: string,
  storage: DraftStorage | null = browserStorage(),
): EntryDraft | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(draftKey(userId, date));

    if (!raw) {
      return null;
    }

    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    // Blocked storage, or a value this code did not write: there is no usable draft.
    return null;
  }
}

/** Returns false when the browser refuses, so the editor never claims the text is kept here. */
export function writeEntryDraft(
  userId: string,
  date: string,
  draft: EntryDraft,
  storage: DraftStorage | null = browserStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(draftKey(userId, date), JSON.stringify(draft));
    return true;
  } catch {
    // Full or blocked: the caller says the text is not kept on this device.
    return false;
  }
}

export function clearEntryDraft(userId: string, date: string, storage: DraftStorage | null = browserStorage()): void {
  removeKeys(storage, (key) => key === draftKey(userId, date));
}

/** Drafts of other days and of other accounts in this browser (see the header for why). */
export function forgetOtherEntryDrafts(
  userId: string,
  date: string,
  storage: DraftStorage | null = browserStorage(),
): void {
  const keep = draftKey(userId, date);
  removeKeys(storage, (key) => key.startsWith(PREFIX) && key !== keep);
}

/** Every draft in this browser; used on sign out and account deletion. */
export function forgetAllEntryDrafts(storage: DraftStorage | null = browserStorage()): void {
  removeKeys(storage, (key) => key.startsWith(PREFIX));
}

function removeKeys(storage: DraftStorage | null, matches: (key: string) => boolean): void {
  if (!storage) {
    return;
  }

  try {
    const keys: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key && matches(key)) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      storage.removeItem(key);
    }
  } catch (error) {
    // Blocked storage holds nothing to remove; anything else is worth knowing about.
    console.error("removing diary drafts failed", { kind: (error as Error).name });
  }
}
