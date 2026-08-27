/* A day, not a row.

   A year of WHOOP arrives as roughly 1500 separate measurements. Shown as a
   flat list — "Сон 6.55", "HRV 41", "Пульс покоя 58", over and over — it is
   unreadable and answers no question anyone actually asks. Nobody wants to
   scroll 1500 numbers; they want to know how a day went, and whether the last
   month is better or worse than the one before.

   So measurements are folded into one card per day, the way a wearable does it,
   and the raw records stay reachable underneath for anyone who wants them. */

import { isLive } from "./schema.js?v=20260827-140121";

/* The metrics that describe a day, in the order they are worth reading. */
export const DAY_METRICS = [
  { key: "recovery", ru: "Восстановление", en: "Recovery", unit: "%", digits: 0, good: "high" },
  { key: "sleep", ru: "Сон", en: "Sleep", unit: "ч", digits: 1, good: "high" },
  { key: "hrv", ru: "HRV", en: "HRV", unit: "мс", digits: 0, good: "high" },
  { key: "rhr", ru: "Пульс покоя", en: "Resting HR", unit: "уд/мин", digits: 0, good: "low" },
  { key: "strain", ru: "Нагрузка", en: "Strain", unit: "", digits: 1, good: "high" },
  { key: "weight", ru: "Вес", en: "Weight", unit: "кг", digits: 1, good: "flat" },
  { key: "steps", ru: "Шаги", en: "Steps", unit: "", digits: 0, good: "high" }
];

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/* One entry per calendar day: its metrics, its workouts, and how much of the
   day is actually known. */
export function buildDays(records, { from = null, to = null } = {}) {
  const days = new Map();

  const day = (date) => {
    if (!days.has(date)) days.set(date, { date, metrics: {}, workouts: [], minutes: 0, distance: 0 });
    return days.get(date);
  };

  for (const record of records) {
    if (!isLive(record) || !record.date) continue;
    if (from && record.date < from) continue;
    if (to && record.date > to) continue;

    if (record.type === "measurement") {
      const value = numeric(record.value);
      if (value === null) continue;
      const bucket = day(record.date).metrics;
      // Several readings in a day average out rather than the last one winning.
      const seen = bucket[record.category];
      bucket[record.category] = seen
        ? { sum: seen.sum + value, count: seen.count + 1, unit: record.unit || seen.unit }
        : { sum: value, count: 1, unit: record.unit || "" };
    } else if (record.type === "workout" && record.status === "done") {
      const entry = day(record.date);
      entry.workouts.push(record);
      entry.minutes += numeric(record.duration) ?? 0;
      entry.distance += numeric(record.distance) ?? 0;
    }
  }

  for (const entry of days.values()) {
    for (const [key, value] of Object.entries(entry.metrics)) {
      entry.metrics[key] = { value: value.sum / value.count, unit: value.unit, readings: value.count };
    }
  }

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export const metricOf = (entry, key) => entry?.metrics?.[key]?.value ?? null;

/* Averages over a stretch of days, and the same stretch immediately before it,
   so a number can be read as "better than last month" rather than in isolation. */
export function comparePeriods(days, length) {
  const current = days.slice(0, length);
  const previous = days.slice(length, length * 2);

  const average = (list, key) => {
    const values = list.map((entry) => metricOf(entry, key)).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  const result = {};
  for (const metric of DAY_METRICS) {
    const now = average(current, metric.key);
    const before = average(previous, metric.key);
    result[metric.key] = {
      value: now,
      previous: before,
      delta: now !== null && before !== null ? now - before : null,
      metric
    };
  }

  const totalMinutes = (list) => list.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalWorkouts = (list) => list.reduce((sum, entry) => sum + entry.workouts.length, 0);

  result.workouts = {
    value: totalWorkouts(current),
    previous: totalWorkouts(previous),
    delta: totalWorkouts(current) - totalWorkouts(previous)
  };
  result.minutes = {
    value: totalMinutes(current),
    previous: totalMinutes(previous),
    delta: totalMinutes(current) - totalMinutes(previous)
  };

  return result;
}

/* Whether a change is an improvement depends on the metric: a lower resting
   heart rate is good news, a lower recovery score is not. */
export function judge(metricKey, delta) {
  if (delta === null || Math.abs(delta) < 1e-9) return "flat";
  const metric = DAY_METRICS.find((item) => item.key === metricKey);
  if (!metric || metric.good === "flat") return "flat";
  const better = metric.good === "high" ? delta > 0 : delta < 0;
  return better ? "better" : "worse";
}

/* A single readable score for a day, used only to colour the card — never
   presented as a medical judgement. */
export function dayTone(entry) {
  const recovery = metricOf(entry, "recovery");
  if (recovery === null) return "unknown";
  if (recovery >= 67) return "good";
  if (recovery >= 34) return "fair";
  return "low";
}

export function monthlySeries(days, key, months = 12) {
  const byMonth = new Map();
  for (const entry of days) {
    const month = entry.date.slice(0, 7);
    const value = metricOf(entry, key);
    if (value === null) continue;
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(value);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([month, values]) => ({
      date: `${month}-15`,
      month,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
      days: values.length
    }));
}

/* How much of the period actually has data — an average over four days out of
   thirty should not be presented with the same confidence as one over thirty. */
export function coverage(days, key, length) {
  const window = days.slice(0, length);
  const known = window.filter((entry) => metricOf(entry, key) !== null).length;
  return { known, total: Math.min(length, days.length), percent: window.length ? Math.round((known / window.length) * 100) : 0 };
}
