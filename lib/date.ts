import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "UTC";

export function toLocalDate(date: Date, timezone = DEFAULT_TIMEZONE) {
  return toZonedTime(date, timezone);
}

export function getDateKey(date: Date, timezone = DEFAULT_TIMEZONE) {
  return format(toLocalDate(date, timezone), "yyyy-MM-dd");
}

export function parseDateKey(dateKey: string, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(`${dateKey}T12:00:00`, timezone);
}

export function toStartOfLocalDay(date: Date, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(startOfDay(toLocalDate(date, timezone)), timezone);
}

export function toEndOfLocalDay(date: Date, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(endOfDay(toLocalDate(date, timezone)), timezone);
}

export function todayKey(timezone = DEFAULT_TIMEZONE) {
  return getDateKey(new Date(), timezone);
}

export function shiftDateKey(dateKey: string, amount: number, timezone = DEFAULT_TIMEZONE) {
  return getDateKey(addDays(parseDateKey(dateKey, timezone), amount), timezone);
}

export function rangeFromPreset(preset: string, timezone = DEFAULT_TIMEZONE) {
  const now = new Date();
  const local = toLocalDate(now, timezone);
  const todayStart = startOfDay(local);
  const todayEnd = endOfDay(local);

  switch (preset) {
    case "today":
      return { from: fromZonedTime(todayStart, timezone), to: fromZonedTime(todayEnd, timezone) };
    case "7d":
      return { from: fromZonedTime(startOfDay(subDays(local, 6)), timezone), to: fromZonedTime(todayEnd, timezone) };
    case "30d":
      return { from: fromZonedTime(startOfDay(subDays(local, 29)), timezone), to: fromZonedTime(todayEnd, timezone) };
    case "90d":
      return { from: fromZonedTime(startOfDay(subDays(local, 89)), timezone), to: fromZonedTime(todayEnd, timezone) };
    case "yesterday": {
      const yd = subDays(local, 1);
      return { from: fromZonedTime(startOfDay(yd), timezone), to: fromZonedTime(endOfDay(yd), timezone) };
    }
    case "mtd":
    case "this-month":
      return { from: fromZonedTime(startOfMonth(local), timezone), to: fromZonedTime(todayEnd, timezone) };
    case "last-month": {
      const lm = subMonths(local, 1);
      return { from: fromZonedTime(startOfMonth(lm), timezone), to: fromZonedTime(endOfMonth(lm), timezone) };
    }
    case "ytd":
    case "this-year":
      return { from: fromZonedTime(new Date(local.getFullYear(), 0, 1), timezone), to: fromZonedTime(todayEnd, timezone) };
    default:
      return { from: fromZonedTime(startOfDay(subDays(local, 29)), timezone), to: fromZonedTime(todayEnd, timezone) };
  }
}

export function enumerateDateKeys(from: Date, to: Date, timezone = DEFAULT_TIMEZONE) {
  const keys: string[] = [];
  let cursor = parseDateKey(getDateKey(from, timezone), timezone);
  const target = parseDateKey(getDateKey(to, timezone), timezone);

  while (cursor <= target) {
    keys.push(getDateKey(cursor, timezone));
    cursor = addDays(cursor, 1);
  }

  return keys;
}

export function bucketDate(date: Date | null | undefined, fallback: Date, timezone = DEFAULT_TIMEZONE) {
  return getDateKey(date ?? fallback, timezone);
}

export function compareDateKeys(left: string, right: string) {
  return differenceInCalendarDays(parseISO(left), parseISO(right));
}

export function monthBounds(year: number, month: number, timezone = DEFAULT_TIMEZONE) {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);
  return {
    from: fromZonedTime(startOfMonth(start), timezone),
    to: fromZonedTime(endOfDay(end), timezone),
  };
}
