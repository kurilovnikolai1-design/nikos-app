/* One page to take to an appointment.
 *
 * Twenty minutes with a doctor is spent reconstructing what happened since
 * the last visit — which tests, when, what changed, what is being taken. All
 * of it is already in the vault and none of it is in one place.
 *
 * This assembles it and nothing else. Every line is either something the
 * owner wrote down or a number the laboratory printed, with its date. There
 * is no summary of what it means, no ordering by severity, no "обратите
 * внимание" — a doctor reading this needs the facts arranged, not a lay
 * opinion about which of them matter.
 *
 * The one judgement made is the same as everywhere else in this product:
 * arithmetic on dates. How long ago something was measured is a fact about a
 * calendar and is genuinely useful to the person reading it. */

import { byAnalyte } from "./labs-parse.js?v=20260827-172643";
import { conditionPanels, knownConditions } from "./conditions.js?v=20260827-172643";
import { resolutions, resolutionState } from "./resolved.js?v=20260827-172643";
import { routeFor } from "./lab-routing.js?v=20260827-172643";
import { localDate } from "./dates.js?v=20260827-172643";

const DAY = 86_400_000;
const monthsSince = (date, now) =>
  Math.round((now - new Date(`${date}T12:00:00`).getTime()) / DAY / 30.44);

/* Everything a visit needs, grouped the way it would be read aloud. */
export function buildSummary(records, { locale = "ru", now = Date.now(), specialist = null } = {}) {
  const groups = byAnalyte(records);
  const resolved = resolutions(records);

  /* Out of range, minus anything the owner has marked as dealt with — that
     conversation has already happened and repeating it wastes the visit. */
  const flagged = groups
    .filter((group) => ["above", "below"].includes(group.verdict))
    .filter((group) => {
      const state = resolutionState(group, resolved);
      return !state || state.reopened;
    })
    .filter((group) => !specialist || routeFor(group.name, locale)?.key === specialist)
    .map((group) => ({
      name: group.name,
      value: group.latest.value,
      unit: group.unit,
      date: group.latest.date,
      months: monthsSince(group.latest.date, now),
      refLow: group.latest.refLow,
      refHigh: group.latest.refHigh,
      verdict: group.verdict,
      readings: group.count,
      /* The earliest reading of the current unbroken run, so the doctor can
         see whether this is new or long-standing. */
      since: runStart(group)
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const conditions = conditionPanels(records, { locale, now }).map((panel) => ({
    name: panel.name,
    specialist: panel.specialist,
    hereditary: panel.hereditary,
    overdue: panel.tracked.filter((entry) => entry.overdue)
      .map((entry) => ({ label: entry.label, date: entry.date, months: Math.round(entry.days / 30) })),
    recent: panel.tracked.filter((entry) => !entry.overdue)
      .map((entry) => ({ label: entry.label, value: entry.value, unit: entry.unit, date: entry.date }))
  }));

  const medication = records
    .filter((record) => record.type === "health" && !record.deletedAt && record.category === "medication")
    .filter((record) => !["archived", "closed"].includes(record.status))
    .map((record) => ({ name: record.name, date: record.date, details: record.details }));

  const procedures = records
    .filter((record) => record.type === "health" && !record.deletedAt && record.category === "procedure")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5)
    .map((record) => ({ name: record.name, date: record.date, details: firstLine(record.details) }));

  const treated = [...resolved.values()]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5)
    .map((entry) => ({ name: entry.name, date: entry.date, note: entry.note }));

  const visits = [...new Set(records
    .filter((record) => record.type === "lab" && !record.deletedAt && record.date)
    .map((record) => record.date))].sort();

  return {
    generatedAt: localDate(now),
    conditions,
    flagged,
    medication,
    procedures,
    treated,
    lastVisit: visits.at(-1) || null,
    visitCount: visits.length,
    analyteCount: groups.length
  };
}

function runStart(group) {
  let start = group.latest.date;
  for (let index = group.history.length - 1; index >= 0; index -= 1) {
    const item = group.history[index];
    const above = item.refHigh !== null && item.refHigh !== undefined && Number(item.value) > item.refHigh;
    const below = item.refLow !== null && item.refLow !== undefined && Number(item.value) < item.refLow;
    if (!above && !below) break;
    start = item.date;
  }
  return start;
}

const firstLine = (text) => {
  if (!text) return "";
  const line = String(text).split("\n").find((part) => part.trim());
  return (line || "").trim().slice(0, 220);
};

export const SUMMARY_NOTE = {
  ru: "Здесь только то, что вы записали, и то, что напечатала лаборатория, — с датами. Nik'Os ничего не толкует и ничего не советует: это лист для приёма, а не заключение.",
  en: "This holds only what you recorded and what the laboratory printed, with dates. Nik'Os interprets nothing and advises nothing — it is a sheet to bring to an appointment, not a report."
};
