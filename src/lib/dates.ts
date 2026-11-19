import { id as indonesianLocale } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * A calendar day in the user's time zone, formatted as "yyyy-MM-dd".
 * These keys are what the `date` columns in the database store, so all day
 * arithmetic happens in calendar space, never in UTC instants.
 */
export type DateKey = string;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MS = 86_400_000;

const pad = (value: number): string => String(value).padStart(2, "0");

/** Builds a UTC anchored Date from a key. Calendar math below never leaves UTC space. */
function parseDateKey(key: DateKey): Date {
  if (!DATE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid date key: ${key}`);
  }

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (formatDateKey(date) !== key) {
    throw new Error(`Invalid date key: ${key}`);
  }

  return date;
}

function formatDateKey(date: Date): DateKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The user's calendar day for a given instant, according to the profile time zone. */
export function toDateKey(instant: Date, timeZone: string): DateKey {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}

/** Today for the user. `now` is injectable so callers and tests stay deterministic. */
export function todayKey(timeZone: string, now: Date = new Date()): DateKey {
  return toDateKey(now, timeZone);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  return formatDateKey(new Date(date.getTime() + days * DAY_IN_MS));
}

/** Whole days from `fromKey` to `toKey`. Negative when `toKey` is earlier. */
export function daysBetween(fromKey: DateKey, toKey: DateKey): number {
  const diff = parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime();
  return Math.round(diff / DAY_IN_MS);
}

/** `count` consecutive days ending at `endKey`, oldest first. */
export function lastNDays(endKey: DateKey, count: number): DateKey[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`count must be a positive integer, received: ${count}`);
  }

  const keys: DateKey[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(addDays(endKey, -offset));
  }

  return keys;
}

/** Weeks run Monday to Sunday, as the weekly reports and progress periods assume. */
export function startOfWeekKey(key: DateKey): DateKey {
  const date = parseDateKey(key);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(key, -daysSinceMonday);
}

export function endOfWeekKey(key: DateKey): DateKey {
  return addDays(startOfWeekKey(key), 6);
}

export function startOfMonthKey(key: DateKey): DateKey {
  parseDateKey(key);
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonthKey(key: DateKey): DateKey {
  const date = parseDateKey(key);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return `${key.slice(0, 7)}-${pad(lastDay)}`;
}

/**
 * The instant the user's current calendar month began (midnight on the 1st in
 * their zone), where monthly counts such as the AI token cap start.
 */
export function startOfLocalMonth(timeZone: string, now: Date = new Date()): Date {
  return fromZonedTime(`${startOfMonthKey(todayKey(timeZone, now))}T00:00:00`, timeZone);
}

/** The first day of the user's next month, when monthly counts start again. */
export function startOfNextMonthKey(key: DateKey): DateKey {
  return addDays(endOfMonthKey(key), 1);
}

/**
 * "Selasa, 28 Oktober" for a date key, as DESIGN.md §4 asks. The key is a
 * calendar day, so it is formatted in UTC to keep the machine's own time zone
 * out of the result.
 */
export function formatDayLabel(key: DateKey): string {
  return formatInTimeZone(parseDateKey(key), "UTC", "EEEE, d MMMM", {
    locale: indonesianLocale,
  });
}

/**
 * The pieces of a day for the calendar page at the top of Hari Ini:
 * { day: "29", weekday: "Kamis", monthYear: "Oktober 2026" }.
 */
export function formatDayParts(key: DateKey): { day: string; weekday: string; monthYear: string } {
  const instant = parseDateKey(key);
  const format = (pattern: string) => formatInTimeZone(instant, "UTC", pattern, { locale: indonesianLocale });

  return { day: format("d"), weekday: format("EEEE"), monthYear: format("MMMM yyyy") };
}

/** The short weekday under each day of the week strip on Hari Ini: "Sen", "Rab", "Min". */
export function formatWeekdayShort(key: DateKey): string {
  return formatInTimeZone(parseDateKey(key), "UTC", "EEE", { locale: indonesianLocale });
}

/** "Oktober 2026" for any day in that month, for the history calendar. */
export function formatMonthLabel(key: DateKey): string {
  return formatInTimeZone(parseDateKey(startOfMonthKey(key)), "UTC", "MMMM yyyy", {
    locale: indonesianLocale,
  });
}

/** True for a real calendar day written as "yyyy-MM-dd"; never throws. */
export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  return formatDateKey(new Date(Date.UTC(year, month - 1, day))) === value;
}

/**
 * True when the runtime knows the zone. A profile with an unknown zone would
 * make every "today" calculation throw, so the server checks this before saving
 * one (AUTH-3). Intl signals an unknown zone with a RangeError; anything else
 * is unexpected and is rethrown.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.trim() === "") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }

    throw error;
  }
}

/** Indonesia's zones and the names people use for them, west to east. */
const INDONESIAN_ZONE_NAMES: Readonly<Record<string, string>> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** The zones of Indonesia, west to east, listed first when the user picks one (AUTH-3). */
export const INDONESIAN_TIME_ZONES: readonly string[] = Object.keys(INDONESIAN_ZONE_NAMES);

/** "WIB", "WITA", or "WIT" for a zone in Indonesia; null for any other zone. */
export function indonesianZoneName(timeZone: string): string | null {
  return INDONESIAN_ZONE_NAMES[timeZone] ?? null;
}

/** "14.32": the time of day in a zone, on the 24 hour clock with a dot, as written in Indonesia. */
export function formatClock(timeZone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timeZone, "HH.mm");
}

/**
 * The weeks of the month that contains `key`, Monday first, for the history
 * calendar (DESIGN.md §6). Days that belong to the neighbouring months are
 * null, so the grid keeps seven columns without showing someone else's days.
 */
export function monthGrid(key: DateKey): (DateKey | null)[][] {
  const first = startOfMonthKey(key);
  const last = endOfMonthKey(key);
  const gridStart = startOfWeekKey(first);
  const gridEnd = endOfWeekKey(last);
  const month = first.slice(0, 7);

  const weeks: (DateKey | null)[][] = [];
  let cursor = gridStart;

  while (daysBetween(cursor, gridEnd) >= 0) {
    const week: (DateKey | null)[] = [];

    for (let day = 0; day < 7; day += 1) {
      week.push(cursor.slice(0, 7) === month ? cursor : null);
      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return weeks;
}
