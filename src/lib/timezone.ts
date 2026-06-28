// Timezone utilities for converting wall-clock times in a given IANA timezone
// to/from UTC instants, without external dependencies.

// Returns the offset (in minutes) of `timeZone` at the given UTC `date`.
// Positive means the zone is ahead of UTC.
export function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // `hour` can come back as 24 for midnight in some environments.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Converts a wall-clock time (year, month [1-12], day, hour, minute) in the
// given IANA timezone into the corresponding UTC Date instant.
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // First pass using the guess instant's offset.
  const offset1 = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess));
  let result = new Date(utcGuess - offset1 * 60000);
  // Second pass to correct around DST transitions.
  const offset2 = getTimeZoneOffsetMinutes(timeZone, result);
  if (offset2 !== offset1) {
    result = new Date(utcGuess - offset2 * 60000);
  }
  return result;
}

// Returns the calendar date parts (year, month [1-12], day) and weekday index
// (0 = Sunday) for the given UTC `date` as observed in `timeZone`.
export function datePartsInTimeZone(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}
