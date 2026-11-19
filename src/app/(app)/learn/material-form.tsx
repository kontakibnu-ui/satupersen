"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/call-action";
import { MAX_SOURCE_LENGTH, MAX_TITLE_LENGTH } from "@/lib/study/rules";
import { createMaterial, updateMaterial } from "./actions";
import { LinedTextarea } from "./lined-textarea";

const formatCount = (value: number) => new Intl.NumberFormat("id-ID").format(value);

/**
 * Adding a material, or fixing a draft (LEARN-1, LEARN-2; DESIGN.md §6 "Form
 * materi"). Both fields are checked here for a quick answer and again by the
 * server, which is what actually refuses.
 */
export function MaterialForm({
  material,
  draft,
  onCreated,
}: {
  /** Present when a draft is being edited. */
  material?: { id: string; title: string; source: string };
  /** Text brought from Ruang baca by "Jadikan materi" (READ-7); the user can still change it. */
  draft?: { title: string; source: string };
  /** Runs once a new material is saved, before leaving the page. */
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(material?.title ?? draft?.title ?? "");
  const [source, setSource] = useState(material?.source ?? draft?.source ?? "");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const sourceTooLong = source.length > MAX_SOURCE_LENGTH;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (title.trim() === "") {
      setMessage("Beri judul materinya dulu.");
      return;
    }

    if (source.trim() === "") {
      setMessage("Tempel atau tulis bahannya dulu.");
      return;
    }

    if (sourceTooLong) {
      setMessage(`Bahan maksimal ${formatCount(MAX_SOURCE_LENGTH)} karakter. Ringkas dulu bagian yang paling penting.`);
      return;
    }

    setPending(true);
    setMessage(undefined);

    const result = await callAction(() =>
      material ? updateMaterial({ id: material.id, title, source }) : createMaterial({ title, source }),
    );

    if (!result.ok) {
      setPending(false);
      setMessage(result.message);
      return;
    }

    if (!material) {
      onCreated?.();
    }

    router.push(`/learn/${"id" in result ? result.id : material?.id}`);
  }

  return (
    <Card as="div" className="mt-6">
      {draft ? (
        <p className="mb-6 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
          Diambil dari Ruang baca. Cek judul dan bahannya dulu, lalu simpan.
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="material-title" className="text-base font-semibold text-text">
            Judul
          </label>
          <Input
            id="material-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Misalnya: Fotosintesis"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="material-source" className="text-base font-semibold text-text">
            Bahan
          </label>
          <p id="material-source-hint" className="text-sm text-text-muted">
            Tempel catatan atau ringkasan yang mau kamu pelajari. AI memeriksa penjelasanmu hanya dari bahan
            ini, dan bahan tidak bisa diubah lagi setelah diperiksa.
          </p>
          <LinedTextarea
            id="material-source"
            value={source}
            onChange={setSource}
            rows={8}
            describedBy="material-source-hint material-source-count"
            invalid={sourceTooLong}
            placeholder="Tempel bahannya di sini."
          />
          <p
            id="material-source-count"
            className={`text-sm tabular-nums ${sourceTooLong ? "font-semibold text-text" : "text-text-muted"}`}
          >
            {formatCount(source.length)} / {formatCount(MAX_SOURCE_LENGTH)}
            {sourceTooLong ? ", terlalu panjang" : ""}
          </p>
        </div>

        {message ? (
          <p role="alert" className="text-base text-text">
            {message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? "Menyimpan…" : material ? "Simpan bahan" : "Simpan materi"}
        </Button>
      </form>
    </Card>
  );
}
