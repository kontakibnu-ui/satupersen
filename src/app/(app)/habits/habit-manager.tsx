"use client";

import { Plus, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HabitChecklist } from "@/components/habit-checklist";
import { BinderSheet, SectionHead } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { FREE_HABIT_LIMIT, type HabitView } from "@/lib/habits";
import { archiveHabit, createHabit, updateHabit } from "./actions";

type Editing = { kind: "create" } | { kind: "edit"; habit: HabitView };

/**
 * The Kebiasaan screen (DESIGN.md §2, §14.2, §14.3): today's checklist on a
 * binder sheet is the one focus. Under it, laid straight on the page, "Kelola"
 * lists the active habits with "Ubah" and "Arsipkan", and "Tambah kebiasaan"
 * is a quiet link. Only while the list is empty is it the primary button. A
 * habit is archived, never deleted (HABIT-1).
 *
 * The free limit is only announced here when the user tries to go past it; the
 * server and the database are what actually refuse (HABIT-3).
 */
export function HabitManager({
  date,
  habits: initialHabits,
  atFreeLimit,
}: {
  date: string;
  habits: HabitView[];
  /** A free account that already holds the most active habits it may. */
  atFreeLimit: boolean;
}) {
  const [habits, setHabits] = useState(initialHabits);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [limitHit, setLimitHit] = useState(false);
  const [pending, setPending] = useState(false);

  const openCreate = () => {
    setNotice(undefined);

    if (atFreeLimit) {
      setLimitHit(true);
      return;
    }

    setLimitHit(false);
    setEditing({ kind: "create" });
  };

  async function archive(id: string) {
    setPending(true);
    setNotice(undefined);
    const result = await archiveHabit(id);
    setPending(false);
    setConfirmingId(null);

    if (!result.ok) {
      setNotice(result.message);
    }
  }

  const doneToday = habits.filter((habit) => habit.doneDates.includes(date)).length;

  return (
    <>
      {habits.length === 0 ? (
        <Card as="div" className="mt-6 flex flex-col items-center py-10 text-center">
          <IconBadge icon={Sprout} size="lg" />
          <p className="mt-4 font-heading text-lg font-bold text-text">Mulai dari satu kebiasaan kecil</p>
          <p className="mt-2 max-w-sm text-base text-text-muted">
            Belum ada kebiasaan. Mulai dari satu yang kecil saja, yang bisa kamu lakukan hari ini.
          </p>
          <Button onClick={openCreate} className="mt-6 w-full sm:w-auto">
            <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
            Tambah kebiasaan
          </Button>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <BinderSheet aria-labelledby="checklist-heading">
            <SectionHead
              id="checklist-heading"
              title="Centang hari ini"
              aside={
                <>
                  {doneToday} dari {habits.length}
                  <span className="sr-only"> selesai</span>
                </>
              }
            />
            <HabitChecklist date={date} habits={habits} setHabits={setHabits} lastRule={false} />
          </BinderSheet>

          <section aria-labelledby="manage-heading">
            <SectionHead id="manage-heading" title="Kelola" aside={`${habits.length} aktif`} />
            <ul>
              {habits.map((habit) => (
                <li key={habit.id} className="flex min-h-14 flex-wrap items-center gap-x-4 border-b border-rule py-1.5">
                  {confirmingId === habit.id ? (
                    <>
                      <span className="min-w-0 flex-1 text-base text-text">Arsipkan “{habit.name}”?</span>
                      <Button variant="secondary" disabled={pending} onClick={() => void archive(habit.id)}>
                        Ya, arsipkan
                      </Button>
                      <Button variant="link" className="min-w-11" onClick={() => setConfirmingId(null)}>
                        Batal
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 text-base text-text">{habit.name}</span>
                      <Button
                        variant="link"
                        className="min-w-11 text-sm font-semibold text-primary"
                        onClick={() => setEditing({ kind: "edit", habit })}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="link"
                        className="min-w-11 text-sm font-semibold text-primary"
                        onClick={() => setConfirmingId(habit.id)}
                      >
                        Arsipkan
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <div>
            <Button variant="link" onClick={openCreate} className="gap-2 text-sm font-semibold text-primary">
              <Plus aria-hidden="true" size={18} strokeWidth={1.8} />
              Tambah kebiasaan
            </Button>
            {limitHit ? (
              <p className="text-sm text-text-muted">
                Paket gratis memuat {FREE_HABIT_LIMIT} kebiasaan aktif. Arsipkan satu dulu untuk menambah yang baru,
                atau{" "}
                <Link href="/settings/plan" className="font-semibold text-primary underline underline-offset-4">
                  lihat paket
                </Link>
                .
              </p>
            ) : null}
          </div>
        </div>
      )}

      <p role="status" className="mt-2 text-sm text-text-muted">
        {notice}
      </p>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === "edit" ? "Ubah kebiasaan" : "Kebiasaan baru"}
      >
        {editing ? <HabitForm editing={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function HabitForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const habit = editing.kind === "edit" ? editing.habit : null;
  const [name, setName] = useState(habit?.name ?? "");
  const [identity, setIdentity] = useState(habit?.identity ?? "");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);

    const result = habit
      ? await updateHabit({ id: habit.id, name, identity })
      : await createHabit({ name, identity });

    setPending(false);

    if (result.ok) {
      onDone();
      return;
    }

    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-[18px]">
      <label className="block text-sm font-semibold text-text">
        Nama kebiasaan
        <Input
          data-autofocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="Contoh: olahraga 15 menit"
          className="mt-1.5 font-normal"
        />
      </label>

      <div>
        <label className="block text-sm font-semibold text-text">
          Identitas (opsional)
          <Input
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            maxLength={200}
            autoComplete="off"
            aria-describedby="identity-hint"
            placeholder="Aku orang yang rutin bergerak"
            className="mt-1.5 font-serif font-normal italic"
          />
        </label>
        <p id="identity-hint" className="mt-1.5 text-sm text-text-muted">
          Kalimat tentang kamu yang sedang dibangun lewat kebiasaan ini.
        </p>
      </div>

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {message}
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
