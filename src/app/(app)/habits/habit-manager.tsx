"use client";

import { ListChecks, Plus, Sprout } from "lucide-react";
import { useState } from "react";
import { HabitChecklist } from "@/components/habit-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, IconBadge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { FREE_HABIT_LIMIT, type HabitView } from "@/lib/habits";
import { archiveHabit, createHabit, updateHabit } from "./actions";

type Editing = { kind: "create" } | { kind: "edit"; habit: HabitView };

/**
 * The Kebiasaan screen (DESIGN.md §2, §6, §8): the checklist for today is the
 * one focus. "Tambah kebiasaan" is the primary button only while the list is
 * empty; after that it is a quiet link, next to "Kelola" for editing and
 * archiving. A habit is archived, never deleted (HABIT-1).
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
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const openCreate = () => {
    if (atFreeLimit) {
      setNotice(
        `Paket gratis memuat ${FREE_HABIT_LIMIT} kebiasaan aktif. Arsipkan satu dulu untuk menambah yang baru.`,
      );
      return;
    }

    setNotice(undefined);
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
  const percent = habits.length === 0 ? 0 : Math.round((doneToday / habits.length) * 100);

  return (
    <>
      {habits.length === 0 ? (
        <Card as="div" className="mt-6 flex flex-col items-center py-10 text-center">
          <IconBadge icon={Sprout} tone="plum" size="lg" />
          <p className="mt-4 font-serif text-xl font-medium text-text">Mulai dari satu kebiasaan kecil</p>
          <p className="mt-2 max-w-sm text-base text-text-muted">
            Belum ada kebiasaan. Mulai dari satu yang kecil saja, yang bisa kamu lakukan hari ini.
          </p>
          <Button onClick={openCreate} className="mt-6 w-full sm:w-auto">
            <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
            Tambah kebiasaan
          </Button>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {/* One sheet: the checklist is the focus, so its progress is one quiet line in it (DESIGN.md §2, §6). */}
          <Card aria-label="Kebiasaan hari ini">
            <CardHeader
              title={managing ? "Kelola kebiasaan" : "Centang hari ini"}
              icon={ListChecks}
              aside={
                <Button
                  variant="link"
                  className="font-semibold text-primary"
                  onClick={() => {
                    setManaging((current) => !current);
                    setConfirmingId(null);
                    setNotice(undefined);
                  }}
                >
                  {managing ? "Selesai mengelola" : "Kelola"}
                </Button>
              }
            />

            {managing ? null : (
              <div className="mt-2 flex items-center gap-3">
                <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-sage transition-[width] duration-200 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="shrink-0 text-sm font-semibold text-text tabular-nums">
                  {percent === 100 ? "Semua beres hari ini" : `${doneToday}/${habits.length} selesai`}
                </p>
              </div>
            )}

            <div className="mt-3">
              {managing ? (
                <ul className="flex flex-col gap-1">
                  {habits.map((habit) => (
                    <li
                      key={habit.id}
                      className="flex min-h-14 flex-wrap items-center gap-2 rounded-2xl px-2 py-2 hover:bg-surface-muted"
                    >
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
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-medium text-text">{habit.name}</span>
                            {habit.identity ? (
                              <span className="block text-sm text-text-muted">{habit.identity}</span>
                            ) : null}
                          </span>
                          <Button variant="link" className="min-w-11" onClick={() => setEditing({ kind: "edit", habit })}>
                            Ubah
                          </Button>
                          <Button variant="link" className="min-w-11" onClick={() => setConfirmingId(habit.id)}>
                            Arsipkan
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <HabitChecklist date={date} habits={habits} setHabits={setHabits} />
              )}
            </div>

            <Button variant="soft" onClick={openCreate} className="mt-3 w-full">
              <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
              Tambah kebiasaan
            </Button>
          </Card>
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
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      <label className="block text-sm text-text-muted">
        Nama kebiasaan
        <Input
          data-autofocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="Contoh: olahraga 15 menit"
          className="mt-1"
        />
      </label>

      <label className="block text-sm text-text-muted">
        Identitas (opsional)
        <Input
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder="Aku orang yang rutin bergerak"
          className="mt-1"
        />
      </label>

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {message}
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
