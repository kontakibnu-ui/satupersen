import { formatInTimeZone } from "date-fns-tz";

/**
 * The greeting at the top of Hari Ini, by the user's own clock: pagi until
 * 10:59, siang until 14:59, sore until 17:59, malam from 18:00 to 03:59.
 */
export function greetingFor(hour: number): string {
  if (hour >= 4 && hour < 11) {
    return "Selamat pagi";
  }

  if (hour >= 11 && hour < 15) {
    return "Selamat siang";
  }

  if (hour >= 15 && hour < 18) {
    return "Selamat sore";
  }

  return "Selamat malam";
}

/** The hour (0 to 23) at an instant in the user's time zone. */
export function localHour(instant: Date, timeZone: string): number {
  return Number(formatInTimeZone(instant, timeZone, "H"));
}

/** The first word of a name, or null when there is no name to use. */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];

  return first ? first : null;
}
