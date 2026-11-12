import { formatInTimeZone } from "date-fns-tz";
import {
  addDays,
  daysBetween,
  formatMonthLabel,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  type DateKey,
} from "@/lib/dates";

/**
 * When a report is due and which days it covers (REPORT-1). Pure, so the rules
 * are tested without a clock or a database. All of it is in the user's own
 * calendar, by their profile time zone.
 */

export type ReportType = "weekly" | "monthly";

export type ReportPeriod = { start: DateKey; end: DateKey };

/** Reports are due at 07:00 local time (REPORT-1). */
const DUE_MINUTE_OF_DAY = 7 * 60;

/**
 * The tick runs every 15 minutes, but a missed run (a deploy, an outage) must
 * not cost the user their report, so the window stays open for two more days
 * after the due day. The row is created once, so staying open never repeats it.
 */
const CATCH_UP_DAYS = 2;

/** Monday to Sunday of the week before the one that contains `today`. */
export function previousWeek(today: DateKey): ReportPeriod {
  const end = addDays(startOfWeekKey(today), -1);

  return { start: addDays(end, -6), end };
}

/** The whole calendar month before the one that contains `today`. */
export function previousMonth(today: DateKey): ReportPeriod {
  const end = addDays(startOfMonthKey(today), -1);

  return { start: startOfMonthKey(end), end };
}

export function periodFor(type: ReportType, today: DateKey): ReportPeriod {
  return type === "weekly" ? previousWeek(today) : previousMonth(today);
}

/** The same length directly before `period`, used to measure the change. */
export function periodBefore(type: ReportType, period: ReportPeriod): ReportPeriod {
  return type === "weekly" ? previousWeek(period.start) : previousMonth(period.start);
}

export type LocalMoment = { day: DateKey; minuteOfDay: number };

/** The user's calendar day and minute of the day at an instant. */
export function localMoment(instant: Date, timeZone: string): LocalMoment {
  const [hours, minutes] = formatInTimeZone(instant, timeZone, "HH:mm").split(":").map(Number);

  return { day: todayKey(timeZone, instant), minuteOfDay: hours * 60 + minutes };
}

/**
 * True while a report of this type may be created for the user: from 07:00 on
 * the due day (Monday, or the 1st), and through the catch-up days after it.
 */
export function isReportWindowOpen(type: ReportType, moment: LocalMoment): boolean {
  const daysIntoPeriod =
    type === "weekly"
      ? daysBetween(startOfWeekKey(moment.day), moment.day)
      : daysBetween(startOfMonthKey(moment.day), moment.day);

  if (daysIntoPeriod === 0) {
    return moment.minuteOfDay >= DUE_MINUTE_OF_DAY;
  }

  return daysIntoPeriod <= CATCH_UP_DAYS;
}

/** Number of days a period covers, both ends included. */
export function periodLength(period: ReportPeriod): number {
  return daysBetween(period.start, period.end) + 1;
}

/**
 * "26–30 Oktober 2026" or "26 Okt – 1 Nov 2026" for a week, and "Oktober 2026"
 * for a month: the heading of a report.
 */
export function formatPeriodLabel(type: ReportType, period: ReportPeriod): string {
  if (type === "monthly") {
    return formatMonthLabel(period.start);
  }

  const startDay = Number(period.start.slice(8));
  const endDay = Number(period.end.slice(8));
  const [startMonthName, startYear] = formatMonthLabel(period.start).split(" ");
  const [endMonthName, endYear] = formatMonthLabel(period.end).split(" ");

  if (period.start.slice(0, 7) === period.end.slice(0, 7)) {
    return `${startDay}–${endDay} ${endMonthName} ${endYear}`;
  }

  const startText = startYear === endYear ? `${startDay} ${startMonthName.slice(0, 3)}` : `${startDay} ${startMonthName.slice(0, 3)} ${startYear}`;

  return `${startText} – ${endDay} ${endMonthName.slice(0, 3)} ${endYear}`;
}
