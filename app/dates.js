/* Today, where the owner is standing.
 *
 * `new Date().toISOString().slice(0, 10)` is the date in UTC, and it was used
 * in eleven places across this app. In Moscow that is wrong for three hours
 * every night: an expense logged at half past midnight got yesterday's date, a
 * reminder shown at one in the morning was recorded as seen yesterday and shown
 * again, and a repeating task landed a day early.
 *
 * Every date in Nik'Os is a calendar day as the owner experienced it, never an
 * instant in time. So there is one function for producing one, and nothing else
 * should be slicing an ISO string.
 *
 * Parsing goes through noon on purpose. A date parsed as midnight sits one hour
 * from a daylight-saving boundary, and arithmetic across such a boundary can
 * land on the previous day; noon has twelve hours of clearance on either side. */

const pad = (value) => String(value).padStart(2, "0");

/* A Date, or a timestamp, as a local YYYY-MM-DD. */
export function localDate(when = new Date()) {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const today = (now = new Date()) => localDate(now);

/* A YYYY-MM-DD back into a Date, at local noon. */
export function fromDate(iso) {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* Whole days between two calendar dates, sign included. Counted from the dates
   themselves rather than from milliseconds, so a clock change cannot make two
   consecutive days differ by 0.958 of one. */
export function daysBetween(fromIso, toIso) {
  const from = fromDate(fromIso);
  const to = fromDate(toIso);
  if (!from || !to) return null;
  return Math.round((to - from) / 86_400_000);
}

export const shiftDays = (iso, days) => {
  const date = fromDate(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return localDate(date);
};
