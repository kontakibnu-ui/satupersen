import { id as indonesianLocale } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

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
 * "Selasa, 28 Oktober" for a date key, as DESIGN.md §4 asks. The key is a
 * calendar day, so it is formatted in UTC to keep the machine's own time zone
 * out of the result.
 */
export function formatDayLabel(key: DateKey): string {
  return formatInTimeZone(parseDateKey(key), "UTC", "EEEE, d MMMM", {
    locale: indonesianLocale,
  });
}
