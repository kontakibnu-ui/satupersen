"use client";

import {
  Annoyed,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Frown,
  Laugh,
  Meh,
  Smile,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { ScribbleCircle } from "@/components/notebook";
import { callAction } from "@/lib/call-action";
import { cn } from "@/lib/utils";
import { saveMoodEnergy } from "./actions";

type Option = { word: string; icon: LucideIcon };

const MOOD: readonly Option[] = [
  { word: "Berat", icon: Frown },
  { word: "Kurang", icon: Annoyed },
  { word: "Biasa", icon: Meh },
  { word: "Baik", icon: Smile },
  { word: "Senang", icon: Laugh },
];

const ENERGY: readonly Option[] = [
  { word: "Habis", icon: BatteryWarning },
  { word: "Lelah", icon: BatteryLow },
  { word: "Cukup", icon: BatteryMedium },
  { word: "Segar", icon: BatteryFull },
  { word: "Penuh", icon: Zap },
];

type Field = "mood" | "energy";

/** The word for a chosen mood or energy (1 to 5), for "Yang ikut dianalisa" on Hari Ini. */
export function feelingWord(field: Field, value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return (field === "mood" ? MOOD : ENERGY)[value - 1]?.word ?? null;
}

/**
 * Mood and energy (MOOD-1, DESIGN.md §14.3 version 5): one row each, five
 * icons with a word, laid straight on the page. All levels share the one ink;
 * the chosen one is circled in pen and its word turns bold, so the choice is
 * shown by shape and weight, not colour alone (§13). The chosen word is also
 * written at the right of the question, in the hand of the notebook. The
 * options are native radio buttons, so arrow keys and screen readers work
 * without extra code.
 *
 * A tap shows at once and is saved by the server; if saving fails the previous
 * choice returns and the reason is written under the rows.
 */
export function MoodEnergy({
  date,
  mood,
  energy,
  setMood,
  setEnergy,
}: {
  date: string;
  mood: number | null;
  energy: number | null;
  setMood: Dispatch<SetStateAction<number | null>>;
  setEnergy: Dispatch<SetStateAction<number | null>>;
}) {
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function choose(field: Field, value: number) {
    const set = field === "mood" ? setMood : setEnergy;
    const previous = field === "mood" ? mood : energy;

    set(value);
    setMessage(undefined);

    const result = await callAction(() => saveMoodEnergy({ date, field, value }));

    if (!result.ok) {
      set(previous);
      setMessage(result.message);
    }
  }

  return (
    <section aria-label="Perasaanmu hari ini" className="flex flex-col gap-6">
      <Row label="Mood" question="Gimana perasaanmu?" field="mood" options={MOOD} value={mood} onChoose={choose} />
      <Row label="Energi" question="Seberapa berenergi kamu?" field="energy" options={ENERGY} value={energy} onChoose={choose} />
      {message ? (
        <p role="status" className="text-sm text-text-muted">
          {message}
        </p>
      ) : (
        <p role="status" className="sr-only" />
      )}
    </section>
  );
}

function Row({
  label,
  question,
  field,
  options,
  value,
  onChoose,
}: {
  label: string;
  question: string;
  field: Field;
  options: readonly Option[];
  value: number | null;
  onChoose: (field: Field, value: number) => Promise<void>;
}) {
  return (
    <div id={field} className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-bold text-text">{question}</h2>
        <p
          className={cn(
            "shrink-0 whitespace-nowrap",
            value ? "font-serif text-base italic text-primary" : "text-sm text-text-muted",
          )}
        >
          {value ? options[value - 1].word : "Pilih satu"}
        </p>
      </div>

      <div role="radiogroup" aria-label={label} className="mt-3 grid grid-cols-5 gap-1">
        {options.map((option, index) => {
          const number = index + 1;
          const Icon = option.icon;
          const chosen = value === number;

          return (
            <label
              key={option.word}
              className={cn(
                "relative flex min-h-[72px] cursor-pointer flex-col items-center gap-1.5 rounded-2xl transition-[color,transform] duration-200 ease-out active:scale-95 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                chosen ? "text-primary" : "text-text-muted hover:text-text",
              )}
            >
              <input
                type="radio"
                name={field}
                value={number}
                checked={chosen}
                onChange={() => void onChoose(field, number)}
                aria-label={`${label} ${number}, ${option.word}`}
                className="sr-only"
              />
              {chosen ? (
                <ScribbleCircle className="absolute -top-1 left-1/2 size-[52px] -translate-x-1/2" />
              ) : null}
              <span aria-hidden="true" className="inline-flex h-11 items-center justify-center">
                <Icon size={24} strokeWidth={1.6} />
              </span>
              <span aria-hidden="true" className={cn("text-xs", chosen ? "font-bold" : "font-medium")}>
                {option.word}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
