"use client";

import { useSyncExternalStore } from "react";
import { clearMaterialDraft, parseMaterialDraft, readMaterialDraftRaw } from "@/lib/books/draft";
import { MaterialForm } from "../material-form";

const subscribe = () => () => {};

/**
 * Materi baru opened by "Jadikan materi" in the reader (READ-7). The selected
 * text waits in sessionStorage; the server render has none, so the form first
 * shows empty and is replaced by the filled one in the browser. The text is
 * cleared only after the material is saved, so a reload keeps it.
 */
export function BookDraftForm() {
  const raw = useSyncExternalStore(subscribe, readMaterialDraftRaw, () => null);
  const draft = parseMaterialDraft(raw);

  return draft ? (
    <MaterialForm key="from-book" draft={draft} onCreated={clearMaterialDraft} />
  ) : (
    <MaterialForm key="empty" />
  );
}
