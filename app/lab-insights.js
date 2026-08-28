/* Observations about laboratory results.
 *
 * The line here is stricter than anywhere else in the product. These are
 * statements about *the numbers*: how long a value has sat outside the range
 * the laboratory printed, whether it moved, whether it was ever retested. Not
 * one of them says what a value means, what might cause it, or what to do
 * about it. Where something has persisted, the observation points at a doctor
 * — which is the only correct destination for that question.
 *
 * Every range used is the laboratory's own. Nik'Os has none of its own. */

import { byAnalyte, rangeVerdict } from "./labs-parse.js?v=20260827-172643";
import { formatNumber, formatDate as formatDateRaw, plural } from "./i18n.js?v=20260827-172643";

/* A Russian medium date already ends in "г."; appending a sentence period
   produced "17 нояб. 2017 г..". */
const formatDate = (value, style) => formatDateRaw(value, style).replace(/\.$/, "");

const DAY = 86_400_000;
const daysSince = (date) => Math.round((Date.now() - new Date(`${date}T12:00:00`).getTime()) / DAY);

const MONTHS = {
  ru: { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" },
  en: { one: "month", other: "months" }
};
const READINGS = {
  ru: { one: "измерение", few: "измерения", many: "измерений", other: "измерения" },
  en: { one: "reading", other: "readings" }
};
const ANALYTES = {
  ru: { one: "показатель", few: "показателя", many: "показателей", other: "показателя" },
  en: { one: "analyte", other: "analytes" }
};

/* How many of the most recent readings in a row fall outside the range. */
function consecutiveOutside(group) {
  let run = 0;
  for (let index = group.history.length - 1; index >= 0; index -= 1) {
    const verdict = rangeVerdict(group.history[index]);
    if (verdict === "above" || verdict === "below") run += 1;
    else break;
  }
  return run;
}

const wasEverNormal = (group) => group.history.some((item) => rangeVerdict(item) === "in");

export function labInsights(records, { locale = "ru" } = {}) {
  const ru = locale === "ru";
  const groups = byAnalyte(records);
  if (!groups.length) return [];

  const found = [];
  const off = groups.filter((group) => ["above", "below"].includes(group.verdict));

  /* Standing deviations: the ones that have not corrected themselves. */
  const persistent = off
    .map((group) => ({ group, run: consecutiveOutside(group) }))
    .filter((entry) => entry.run >= 3)
    .sort((a, b) => b.run - a.run);

  for (const { group, run } of persistent.slice(0, 3)) {
    const since = group.history[group.history.length - run];
    found.push({
      id: `persistent-${group.name}`,
      tone: "warn",
      title: group.name,
      text: ru
        ? `${run} ${plural(run, READINGS)} подряд вне нормы, начиная с ${formatDate(since.date, "medium")}. Сейчас ${valueText(group)}, норма лаборатории ${rangeText(group.latest, ru)}.`
        : `${run} readings in a row outside the range, since ${formatDate(since.date, "medium")}. Now ${valueText(group)}, the laboratory's range is ${rangeText(group.latest, ru)}.`,
      sample: ru ? "стоит показать врачу" : "worth showing a doctor"
    });
  }

  /* Something that has just left the range for the first time. */
  const newlyOff = off.filter((group) => consecutiveOutside(group) === 1 && group.count > 1 && wasEverNormal(group));
  if (newlyOff.length) {
    found.push({
      id: "newly-off",
      tone: "warn",
      title: ru ? "Впервые вышли за норму" : "Newly outside the range",
      text: newlyOff.slice(0, 4).map((group) => `${group.name} — ${valueText(group)}`).join("; "),
      sample: ru
        ? `по сдаче ${formatDate(newlyOff[0].latest.date, "medium")}`
        : `at the visit of ${formatDate(newlyOff[0].latest.date, "medium")}`
    });
  }

  /* Something that came back. */
  const recovered = groups.filter((group) => {
    if (group.count < 2 || group.verdict !== "in") return false;
    const previous = group.history.at(-2);
    return ["above", "below"].includes(rangeVerdict(previous));
  });
  if (recovered.length) {
    found.push({
      id: "back-in-range",
      tone: "good",
      title: ru ? "Вернулись в норму" : "Back within range",
      text: recovered.slice(0, 4).map((group) => `${group.name} — ${valueText(group)}`).join("; "),
      sample: ru ? "по сравнению с прошлой сдачей" : "compared with the previous visit"
    });
  }

  /* Sitting right on a boundary is worth knowing before it crosses. */
  const borderline = groups.filter((group) => {
    if (group.verdict !== "in") return false;
    const value = Number(group.latest.value);
    const { refLow, refHigh } = group.latest;
    if (refHigh !== null && refHigh !== undefined && refHigh !== 0) {
      if (value >= refHigh * 0.95) return true;
    }
    if (refLow !== null && refLow !== undefined && refLow !== 0) {
      if (value <= refLow * 1.05) return true;
    }
    return false;
  });
  if (borderline.length) {
    found.push({
      id: "borderline",
      tone: "neutral",
      title: ru ? "На границе нормы" : "At the edge of the range",
      text: borderline.slice(0, 4).map((group) =>
        `${group.name} — ${valueText(group)} (${rangeText(group.latest, ru)})`).join("; "),
      sample: ru ? "в пределах нормы, но у самого края" : "inside the range, but only just"
    });
  }

  /* A deviation nobody has looked at again is not a resolved deviation. */
  const stale = off
    .map((group) => ({ group, days: daysSince(group.latest.date) }))
    .filter((entry) => entry.days > 365);
  if (stale.length) {
    found.push({
      id: "not-retested",
      tone: "neutral",
      title: ru ? "Давно не пересдавали" : "Not retested in a while",
      text: ru
        ? `${stale.length} ${plural(stale.length, ANALYTES)} вне нормы не пересдавались больше года: ${stale.slice(0, 3).map((entry) => entry.group.name).join(", ")}${stale.length > 3 ? "…" : ""}.`
        : `${stale.length} analytes outside the range have not been retested for over a year: ${stale.slice(0, 3).map((entry) => entry.group.name).join(", ")}${stale.length > 3 ? "…" : ""}.`,
      sample: ru ? "по датам последних сдач" : "from the latest visit dates"
    });
  }

  /* When the last set of results is itself old. */
  const dates = [...new Set(records.filter((r) => r.type === "lab" && r.date).map((r) => r.date))].sort();
  if (dates.length) {
    const months = Math.floor(daysSince(dates.at(-1)) / 30);
    if (months >= 6) {
      found.push({
        id: "last-visit",
        tone: "neutral",
        title: ru ? "Последняя сдача давно" : "The last set of results is old",
        text: ru
          ? `Прошло ${months} ${plural(months, MONTHS)} с ${formatDate(dates.at(-1), "medium")}.`
          : `${months} months since ${formatDate(dates.at(-1), "medium")}.`,
        sample: ru ? `всего сдач: ${dates.length}` : `${dates.length} visits in total`
      });
    }
  }

  const order = { warn: 0, good: 1, neutral: 2 };
  return found.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}

const valueText = (group) =>
  [formatNumber(group.latest.value, 2), group.unit].filter(Boolean).join(" ");

function rangeText(record, ru) {
  const { refLow, refHigh } = record;
  const has = (value) => value !== null && value !== undefined;
  if (has(refLow) && has(refHigh)) return `${formatNumber(refLow, 2)} – ${formatNumber(refHigh, 2)}`;
  if (has(refHigh)) return `${ru ? "до" : "up to"} ${formatNumber(refHigh, 2)}`;
  if (has(refLow)) return `${ru ? "от" : "from"} ${formatNumber(refLow, 2)}`;
  return ru ? "не указана" : "not given";
}

export const LAB_DISCLAIMER = {
  ru: "Это наблюдения о ваших цифрах и о том, как они менялись. Nik'Os не объясняет, что они значат, и не заменяет врача — сравнение идёт только с нормами, которые напечатала сама лаборатория.",
  en: "These are observations about your numbers and how they moved. Nik'Os does not explain what they mean and does not replace a doctor — the only ranges used are the ones the laboratory itself printed."
};
