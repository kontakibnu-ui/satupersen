"use client";

import { Archive, Plus, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HabitChecklist } from "@/components/habit-checklist";
import { BinderSheet, SectionHead, StickyNote } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { callAction } from "@/lib/call-action";
import { FREE_HABIT_LIMIT, type HabitView } from "@/lib/habits";
import { streakAtRisk } from "@/lib/streak";
import { archiveHabit, createHabit, updateHabit } from "./actions";

type Editing = { kind: "create" } | { kind: "edit"; habit: HabitView };

/**
 * The Kebiasaan screen (DESIGN.md §2, §14.2, §14.3, §15.7): today's checklist on
 * a binder sheet is the one focus, each row with the last seven days under it
 * and a button that opens its settings sheet, where it is renamed or archived.
 * A sticky note speaks up when a streak hangs on today. "Tambah kebiasaan" is
 * a quiet link; only while the list is empty is it the primary button. A habit
 * is archived, never deleted (HABIT-1).
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
  const [limitHit, setLimitHit] = useState(false);

  const openCreate = () => {
    if (atFreeLimit) {
      setLimitHit(true);
      return;
    }

    setLimitHit(false);
    setEditing({ kind: "create" });
  };

  const doneToday = habits.filter((habit) => habit.doneDates.includes(date)).length;
  const atRisk = habits.filter((habit) => streakAtRisk(habit.doneDates, date)).map((habit) => habit.name);

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
            {atRisk.length > 0 ? (
              <StickyNote role="note" className="mt-6 mb-3">
                <p className="text-sm font-bold text-primary">Kemarin terlewat, tidak apa-apa</p>
                <p className="mt-1 font-serif text-lg leading-snug text-text italic">
                  Centang {joinNames(atRisk)} hari ini, streak-nya tetap jalan.
                </p>
              </StickyNote>
            ) : null}
            <HabitChecklist
              date={date}
              habits={habits}
              setHabits={setHabits}
              lastRule={false}
              showWeek
              onEdit={(habit) => setEditing({ kind: "edit", habit })}
            />
          </BinderSheet>

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

    const result = await callAction(() =>
      habit ? updateHabit({ id: habit.id, name, identity }) : createHabit({ name, identity }),
    );

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

      {habit ? <ArchiveHabit habit={habit} onArchived={onDone} /> : null}
    </form>
  );
}

/**
 * Archiving lives in the settings sheet, away from the box that checks the
 * habit (DESIGN.md §15.7), and asks once in place. Archived, never deleted
 * (HABIT-1): the checked days stay.
 */
function ArchiveHabit({ habit, onArchived }: { habit: HabitView; onArchived: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function archive() {
    setPending(true);
    setMessage(undefined);
    const result = await callAction(() => archiveHabit(habit.id));
    setPending(false);

    if (result.ok) {
      onArchived();
      return;
    }

    setConfirming(false);
    setMessage(result.message);
  }

  return (
    <div className="border-t border-rule pt-3">
      {confirming ? (
        <>
          <p className="text-base text-text">Arsipkan “{habit.name}”? Kebiasaan ini hilang dari daftar, tapi riwayat centangnya tetap tersimpan.</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void archive()}>
              Ya, arsipkan
            </Button>
            <Button type="button" variant="link" className="min-w-11" onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button type="button" variant="link" onClick={() => setConfirming(true)} className="gap-2 text-sm font-semibold text-primary">
            <Archive aria-hidden="true" size={16} strokeWidth={1.8} />
            Arsipkan kebiasaan
          </Button>
          <p className="text-sm text-text-muted">Hilang dari daftar, riwayat centangnya tetap tersimpan.</p>
        </>
      )}
      <p role="status" className="mt-1 text-sm text-text-muted">
        {message}
      </p>
    </div>
  );
}

/** "a", "a dan b", "a, b, dan c" for the sticky note. */
function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} dan ${names[names.length - 1]}`;
}
