/* Things that come back.
 *
 * A service, an insurance renewal, a meter reading, a quarterly payment.
 * Until now each one had to be typed again after being ticked off, which
 * means in practice it was typed once and then forgotten — the failure this
 * whole product exists to prevent.
 *
 * The schema has carried a FREQUENCY enum since the rebuild and no type used
 * it. This wires it to tasks, so a repeating task recreates itself when it is
 * marked done.
 *
 * Two rules keep it from lying about history:
 *
 *   The completed task stays completed. Rolling its date forward would erase
 *   the record that it was ever done, and "когда я в последний раз менял
 *   масло" is exactly the question this is meant to answer. So a fresh task
 *   is created and the old one is left alone.
 *
 *   The next date is counted from the date that was due, not from today.
 *   Servicing a car three weeks late does not move the schedule three weeks
 *   later for ever. When lateness has pushed the next date into the past
 *   already, it advances until it is ahead — no backlog of phantom tasks. */

import { FREQUENCY } from "./schema.js?v=20260828-003727";
import { localDate, fromDate } from "./dates.js?v=20260828-003727";

const STEP = {
  weekly:    (date) => date.setDate(date.getDate() + 7),
  biweekly:  (date) => date.setDate(date.getDate() + 14),
  monthly:   (date) => date.setMonth(date.getMonth() + 1),
  quarterly: (date) => date.setMonth(date.getMonth() + 3),
  annual:    (date) => date.setFullYear(date.getFullYear() + 1)
};

export const isRepeating = (record) =>
  Boolean(record?.frequency) && Object.hasOwn(FREQUENCY, record.frequency);

/* The next occurrence after a given date, skipping any that have already
   passed. Returns null for a frequency this does not know. */
export function nextOccurrence(fromISO, frequency, { now = new Date() } = {}) {
  const step = STEP[frequency];
  if (!step) return null;

  const start = fromDate(fromISO || localDate(now));
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const next = new Date(start);

  /* Bounded: a yearly task last done in 1990 must not spin for ever. */
  for (let guard = 0; guard < 400; guard += 1) {
    step(next);
    if (next > today) break;
  }
  return localDate(next);
}

/* The follow-up task for one that was just completed, or null when the record
   does not repeat. The caller saves it; nothing here writes to the store. */
export function nextTaskFrom(record, { now = new Date(), blank } = {}) {
  if (!isRepeating(record) || record.type !== "task") return null;

  const dueOn = record.date || localDate(now);
  const date = nextOccurrence(dueOn, record.frequency, { now });
  if (!date) return null;

  const base = typeof blank === "function" ? blank("task") : {};

  return {
    ...base,
    type: "task",
    name: record.name,
    category: record.category,
    priority: record.priority,
    owner: record.owner,
    details: record.details,
    frequency: record.frequency,
    linkedIds: [...(record.linkedIds || [])],
    status: "planned",
    date,
    /* A reminder that was set relative to the due date keeps that offset. */
    reminderDate: offsetReminder(record, date)
  };
}

function offsetReminder(record, nextDate) {
  if (!record.reminderDate || !record.date) return null;
  const due = new Date(`${record.date}T12:00:00`);
  const remind = new Date(`${record.reminderDate}T12:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(remind.getTime())) return null;

  const offsetDays = Math.round((remind - due) / 86_400_000);
  const next = new Date(`${nextDate}T12:00:00`);
  next.setDate(next.getDate() + offsetDays);
  return localDate(next);
}

export const frequencyLabel = (key, locale = "ru") =>
  (FREQUENCY[key] ? (locale === "ru" ? FREQUENCY[key].ru : FREQUENCY[key].en) : "");

export const RECURRENCE_NOTE = {
  ru: "Выполненная задача остаётся выполненной — рядом создаётся следующая. Так видно, когда вы делали это в прошлый раз.",
  en: "A completed task stays completed and a fresh one is created beside it, so the record of when it was last done survives."
};
