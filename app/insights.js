/* Observations, not advice.

   Everything here is arithmetic over the owner's own numbers, stated with the
   sample it rests on. Nik'Os does not tell anyone to sleep more, does not
   compare them to a population, and does not carry thresholds of its own — the
   only judgements it makes about health come from a laboratory's printed
   reference range, and those live in labs-parse.js.

   Two rules keep this honest:

   1. Nothing is shown without enough days behind it. A pattern drawn from four
      nights is noise wearing a confident sentence, and confident sentences
      about someone's body are exactly what this must not produce.
   2. Every claim carries its sample size, so the owner can weigh it himself. */

import { metricOf } from "./health-days.js?v=20260828-004404";
import { isLive } from "./schema.js?v=20260828-004404";
import { formatNumber, formatDate, countOf, PLURALS } from "./i18n.js?v=20260828-004404";

const MIN_SAMPLE = 8;          // days on each side of any comparison
const MIN_TREND_MONTHS = 3;

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
/* Numbers and dates go through the same locale formatting as the rest of the
   interface: a Russian reader expects 6,9 and "13 авг.", not 6.9 and 2026-08-13. */
const round = (value, digits = 1) => formatNumber(value, digits);
// formatDate already ends a short Russian date with a period.
const when = (date) => formatDate(date, "short").replace(/\.$/, "");

/* ---------- Individual observations ---------- */

/* Recovery on the day after a long night against the day after a short one.
   Split at the owner's own median, never at a number we invented. */
function sleepVersusRecovery(days, ru) {
  const chronological = [...days].reverse();
  const pairs = [];

  for (let index = 0; index < chronological.length - 1; index += 1) {
    const sleep = metricOf(chronological[index], "sleep");
    const nextRecovery = metricOf(chronological[index + 1], "recovery");
    if (sleep !== null && nextRecovery !== null) pairs.push({ sleep, recovery: nextRecovery });
  }
  if (pairs.length < MIN_SAMPLE * 2) return null;

  const median = [...pairs].sort((a, b) => a.sleep - b.sleep)[Math.floor(pairs.length / 2)].sleep;
  const longer = pairs.filter((pair) => pair.sleep >= median);
  const shorter = pairs.filter((pair) => pair.sleep < median);
  if (longer.length < MIN_SAMPLE || shorter.length < MIN_SAMPLE) return null;

  const difference = mean(longer.map((p) => p.recovery)) - mean(shorter.map((p) => p.recovery));
  if (Math.abs(difference) < 3) return null;                    // smaller than day-to-day noise

  const better = difference > 0;
  return {
    id: "sleep-recovery",
    tone: better ? "good" : "neutral",
    title: ru ? "Сон и восстановление" : "Sleep and recovery",
    text: ru
      ? `После ночей дольше ${round(median, 1)} ч восстановление в среднем на ${round(Math.abs(difference), 0)} % ${better ? "выше" : "ниже"}, чем после более коротких.`
      : `After nights longer than ${round(median, 1)} h, recovery averages ${round(Math.abs(difference), 0)}% ${better ? "higher" : "lower"} than after shorter ones.`,
    sample: ru
      ? `${longer.length} длинных ночей против ${shorter.length} коротких`
      : `${longer.length} longer nights against ${shorter.length} shorter`
  };
}

/* What a training day does to the next morning. */
function trainingVersusRecovery(days, ru) {
  const chronological = [...days].reverse();
  const after = [];
  const rest = [];

  for (let index = 0; index < chronological.length - 1; index += 1) {
    const recovery = metricOf(chronological[index + 1], "recovery");
    if (recovery === null) continue;
    (chronological[index].workouts.length ? after : rest).push(recovery);
  }
  if (after.length < MIN_SAMPLE || rest.length < MIN_SAMPLE) return null;

  const difference = mean(after) - mean(rest);
  if (Math.abs(difference) < 3) return null;

  return {
    id: "training-recovery",
    tone: difference >= 0 ? "good" : "neutral",
    title: ru ? "Тренировки и следующее утро" : "Training and the next morning",
    text: ru
      ? `После дней с тренировкой восстановление в среднем на ${round(Math.abs(difference), 0)} % ${difference > 0 ? "выше" : "ниже"}, чем после дней отдыха.`
      : `After days with a workout, recovery averages ${round(Math.abs(difference), 0)}% ${difference > 0 ? "higher" : "lower"} than after rest days.`,
    sample: ru
      ? `${after.length} дней после тренировок, ${rest.length} после отдыха`
      : `${after.length} days after training, ${rest.length} after rest`
  };
}

/* A metric moving the same way for three months or more. */
function monthlyTrend(days, key, label, unit, digits, goodDirection, ru) {
  const byMonth = new Map();
  for (const entry of days) {
    const value = metricOf(entry, key);
    if (value === null) continue;
    const month = entry.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(value);
  }

  const months = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, values]) => values.length >= 5)
    .map(([month, values]) => ({ month, value: mean(values) }));

  if (months.length < MIN_TREND_MONTHS) return null;

  const recent = months.slice(-MIN_TREND_MONTHS);
  const rising = recent.every((point, index) => index === 0 || point.value > recent[index - 1].value);
  const falling = recent.every((point, index) => index === 0 || point.value < recent[index - 1].value);
  if (!rising && !falling) return null;

  const change = recent.at(-1).value - recent[0].value;
  if (Math.abs(change) < 10 ** -digits) return null;

  const favourable = goodDirection === "flat" ? null : (rising === (goodDirection === "high"));

  return {
    id: `trend-${key}`,
    tone: favourable === null ? "neutral" : favourable ? "good" : "warn",
    title: ru ? `${label}: ${rising ? "растёт" : "снижается"}` : `${label}: ${rising ? "rising" : "falling"}`,
    text: ru
      ? `Третий месяц подряд ${rising ? "вверх" : "вниз"}: ${round(recent[0].value, digits)} → ${round(recent.at(-1).value, digits)} ${unit}.`
      : `Three months in the same direction: ${round(recent[0].value, digits)} → ${round(recent.at(-1).value, digits)} ${unit}.`,
    sample: ru ? `по месячным средним` : `monthly averages`
  };
}

/* How long since the last workout, and the current run of days with one. */
function trainingRhythm(days, records, ru) {
  const workoutDays = new Set(records
    .filter((record) => isLive(record) && record.type === "workout" && record.status === "done" && record.date)
    .map((record) => record.date));
  if (!workoutDays.size) return null;

  const latest = [...workoutDays].sort().at(-1);
  const gapDays = Math.round((Date.now() - new Date(`${latest}T12:00:00`).getTime()) / 86_400_000);

  const recent = days.slice(0, 28);
  if (recent.length < 14) return null;
  const inLast28 = recent.filter((entry) => entry.workouts.length).length;
  const previous28 = days.slice(28, 56);
  const inPrevious28 = previous28.filter((entry) => entry.workouts.length).length;

  if (gapDays >= 5) {
    return {
      id: "training-gap",
      tone: "warn",
      title: ru ? "Перерыв в тренировках" : "A gap in training",
      text: ru
        ? `Последняя тренировка была ${countOf(gapDays, PLURALS.day)} назад. За 28 дней их ${inLast28}.`
        : `The last workout was ${gapDays} days ago. There were ${inLast28} in the past 28 days.`,
      sample: ru ? "по записям тренировок" : "from workout records"
    };
  }

  if (previous28.length >= 14 && Math.abs(inLast28 - inPrevious28) >= 4) {
    const more = inLast28 > inPrevious28;
    return {
      id: "training-volume",
      tone: more ? "good" : "neutral",
      title: ru ? (more ? "Тренируешься чаще" : "Тренируешься реже") : (more ? "Training more" : "Training less"),
      text: ru
        ? `${inLast28} дней с тренировкой за 28 дней против ${inPrevious28} в предыдущие 28.`
        : `${inLast28} training days in the past 28, against ${inPrevious28} in the 28 before.`,
      sample: ru ? "по записям тренировок" : "from workout records"
    };
  }

  return null;
}

/* An average over four readings should not be presented like one over thirty. */
function thinData(days, ru) {
  const window = days.slice(0, 30);
  if (window.length < 14) return null;

  const sparse = [
    { key: "weight", ru: "вес", en: "weight" },
    { key: "sleep", ru: "сон", en: "sleep" },
    { key: "recovery", ru: "восстановление", en: "recovery" }
  ]
    .map((metric) => ({ ...metric, known: window.filter((entry) => metricOf(entry, metric.key) !== null).length }))
    .filter((metric) => metric.known > 0 && metric.known < 8);

  if (!sparse.length) return null;

  return {
    id: "thin-data",
    tone: "neutral",
    title: ru ? "Данных мало для выводов" : "Not enough data to read a trend",
    text: ru
      ? `За 30 дней измерений мало: ${sparse.map((m) => `${m.ru} — ${m.known}`).join(", ")}. Динамику по ним строить рано.`
      : `Over 30 days the readings are sparse: ${sparse.map((m) => `${m.en} — ${m.known}`).join(", ")}. Too few for a trend.`,
    sample: ru ? "проверка полноты данных" : "data coverage check"
  };
}

/* The owner's own best stretch, as a fact rather than a target. */
function bestStretch(days, ru) {
  const window = days.filter((entry) => metricOf(entry, "recovery") !== null);
  if (window.length < 30) return null;

  const chronological = [...window].reverse();
  let best = null;
  for (let index = 0; index + 7 <= chronological.length; index += 1) {
    const slice = chronological.slice(index, index + 7);
    const average = mean(slice.map((entry) => metricOf(entry, "recovery")));
    if (!best || average > best.average) best = { average, from: slice[0].date, to: slice.at(-1).date };
  }
  if (!best) return null;

  const recentAverage = mean(days.slice(0, 7).map((entry) => metricOf(entry, "recovery")).filter((value) => value !== null));
  if (recentAverage === null || best.average - recentAverage < 5) return null;

  return {
    id: "best-week",
    tone: "neutral",
    title: ru ? "Лучшая неделя" : "Your best week",
    text: ru
      ? `Самое высокое среднее восстановление — ${round(best.average, 0)} % в неделю с ${when(best.from)}. Сейчас ${round(recentAverage, 0)} %.`
      : `The highest weekly recovery average was ${round(best.average, 0)}% in the week of ${when(best.from)}. It is ${round(recentAverage, 0)}% now.`,
    sample: ru ? "скользящее окно в 7 дней" : "rolling 7-day window"
  };
}

/* ---------- Assembly ---------- */

export function healthInsights(days, records, { locale = "ru" } = {}) {
  const ru = locale === "ru";
  if (days.length < 14) return [];

  const found = [
    trainingRhythm(days, records, ru),
    sleepVersusRecovery(days, ru),
    trainingVersusRecovery(days, ru),
    monthlyTrend(days, "rhr", ru ? "Пульс покоя" : "Resting heart rate", ru ? "уд/мин" : "bpm", 0, "low", ru),
    monthlyTrend(days, "hrv", "HRV", ru ? "мс" : "ms", 0, "high", ru),
    monthlyTrend(days, "weight", ru ? "Вес" : "Weight", ru ? "кг" : "kg", 1, "flat", ru),
    monthlyTrend(days, "sleep", ru ? "Сон" : "Sleep", ru ? "ч" : "h", 1, "high", ru),
    bestStretch(days, ru),
    thinData(days, ru)
  ].filter(Boolean);

  const order = { warn: 0, good: 1, neutral: 2 };
  return found.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 5);
}

export const DISCLAIMER = {
  ru: "Это наблюдения по вашим собственным цифрам, а не советы и не диагноз. Nik'Os не сравнивает вас с нормами и не заменяет врача.",
  en: "These are observations from your own numbers — not advice, and not a diagnosis. Nik'Os does not compare you to any norm and does not replace a doctor."
};
