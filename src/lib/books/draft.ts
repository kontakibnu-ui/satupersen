import { z } from "@/lib/zod";
import { MAX_SOURCE_LENGTH, MAX_TITLE_LENGTH } from "@/lib/study/rules";

/**
 * "Jadikan materi" (PRD.md READ-7) hands the selected text from the reader to
 * the Materi baru form through sessionStorage, so it never reaches the server
 * before the user presses "Simpan materi". Browser only; the tab's storage is
 * gone when the tab closes.
 */

const DRAFT_KEY = "satupersen-material-draft";

const draftSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH),
  source: z.string().min(1).max(MAX_SOURCE_LENGTH),
});

export type MaterialDraft = z.infer<typeof draftSchema>;

/** Returns false when the browser refuses storage, so the reader can say so. */
export function saveMaterialDraft(draft: MaterialDraft): boolean {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftSchema.parse(draft)));
    return true;
  } catch {
    return false;
  }
}

/** The raw stored value, stable between calls, for useSyncExternalStore. */
export function readMaterialDraftRaw(): string | null {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function parseMaterialDraft(raw: string | null): MaterialDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearMaterialDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage is blocked, so there is nothing stored to clear either.
  }
}
