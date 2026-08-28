/* Findings the owner has since dealt with.
 *
 * A laboratory result is a fact about one morning, but "currently outside the
 * range" quietly treats the most recent reading as the present state. After a
 * course of treatment those two things part company: an eradicated H. pylori
 * still shows the positive test that led to the treatment, and the product
 * goes on pointing at a doctor for something already handled.
 *
 * So the owner can mark a finding as treated. Three rules keep that honest:
 *
 *   1. It never deletes or hides a reading. The number stays, the history
 *      stays, the chart stays. Only the "needs attention" framing is dropped.
 *   2. It expires by itself. A resolution covers readings taken BEFORE it; a
 *      later reading that is still out of range makes the analyte active
 *      again, with no action required from anyone.
 *   3. It says when nothing confirmed it. Marked as treated and never retested
 *      is a different state from marked as treated and clear afterwards, and
 *      the two are never shown as the same thing.
 *
 * Rule 3 is a statement about dates, not about a body — the same line every
 * other health module in Nik'Os holds.
 *
 * A resolution is stored as an ordinary health record: category "condition",
 * status "closed", and a name equal to the analyte it refers to. The name is
 * filled in from the analyte itself rather than typed, so the link cannot be
 * broken by a spelling difference. */

import { localDate } from "./dates.js?v=20260828-004404";

const isResolution = (record) =>
  record.type === "health"
  && !record.deletedAt
  && record.category === "condition"
  && record.status === "closed"
  && Boolean(record.name);

/* analyte name -> the most recent resolution recorded for it */
export function resolutions(records) {
  const map = new Map();
  for (const record of records) {
    if (!isResolution(record)) continue;
    const key = String(record.name).trim().toLowerCase();
    const previous = map.get(key);
    if (!previous || String(record.date) > String(previous.date)) {
      map.set(key, { date: record.date, note: record.details || "", id: record.id, name: record.name });
    }
  }
  return map;
}

/* The state of one analyte once its resolutions are taken into account.
   Returns null when the owner has never marked it, which is the common case. */
export function resolutionState(group, map) {
  const entry = map.get(String(group.name).trim().toLowerCase());
  if (!entry) return null;

  const readingsAfter = group.history.filter((item) => String(item.date) > String(entry.date));
  const stillOff = readingsAfter.length
    && ["above", "below"].includes(group.verdict);

  return {
    date: entry.date,
    note: entry.note,
    recordId: entry.id,
    /* Retested after treatment and clear — the strongest state there is. */
    confirmed: readingsAfter.length > 0 && !stillOff,
    /* Nothing was measured after the treatment date. */
    unconfirmed: readingsAfter.length === 0,
    /* Measured after treatment and still outside the range: the resolution
       no longer applies and the analyte returns to the active list. */
    reopened: Boolean(stillOff)
  };
}

/* Split out-of-range analytes into the ones still needing a doctor and the
   ones already dealt with. Nothing is discarded — both halves are returned. */
export function partitionByResolution(groups, records) {
  const map = resolutions(records);
  const active = [];
  const resolved = [];

  for (const group of groups) {
    const state = resolutionState(group, map);
    if (state && !state.reopened) resolved.push({ group, state });
    else active.push(group);
  }
  return { active, resolved };
}

/* The draft for the record that marks a finding as treated. The form is opened
   with this rather than saved silently: what was treated, and when, is the
   owner's statement about his own care, not an inference from a number. */
export function resolutionPreset(group, today = localDate()) {
  return {
    category: "condition",
    status: "closed",
    name: group.name,
    date: today,
    owner: "me"
  };
}

export const RESOLVED_NOTE = {
  ru: "Отмеченное как пролеченное остаётся в истории целиком — скрывается только пометка «нужно внимание». Если после этой даты появится новый результат вне нормы, показатель вернётся в список сам.",
  en: "Anything marked as treated keeps its full history — only the needs-attention flag is dropped. If a later result comes back outside the range, the analyte returns to the active list on its own."
};
