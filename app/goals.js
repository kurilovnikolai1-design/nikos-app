/* Money with a deadline.
 *
 * The app could already say what exists and what moved. A goal is the third
 * question: where is this going, and will it get there in time. That is pure
 * arithmetic over two numbers the owner supplies — what is set aside and what
 * is needed — plus, optionally, a date.
 *
 * The only judgement made here is about the calendar: whether the amount put
 * aside per month so far would reach the target by the date named. It is
 * stated as what the arithmetic says, never as advice about what to do.
 *
 * A goal holds no balance of its own. The money is already counted wherever
 * it actually sits, and counting it twice would inflate net worth — which is
 * why the schema gives this type no balance role. */

import { valueInBase } from "./finance.js?v=20260827-142201";

const DAY = 86_400_000;
const MONTH_DAYS = 30.44;

export const GOAL_STATE = {
  NO_TARGET: "no-target",   /* nothing to measure against yet */
  REACHED: "reached",
  ON_TRACK: "on-track",
  BEHIND: "behind",
  NO_DEADLINE: "no-deadline"
};

const monthsBetween = (fromISO, toISO) => {
  const from = new Date(`${fromISO}T12:00:00`);
  const to = new Date(`${toISO}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return (to - from) / DAY / MONTH_DAYS;
};

/* One goal, measured. Returns null for a record that is not a usable goal
   rather than inventing a target it does not have. */
export function goalProgress(record, base, rates, { now = new Date() } = {}) {
  if (record.type !== "goal" || record.deletedAt) return null;

  const target = valueInBase({ ...record, amountMinor: record.targetAmountMinor }, base, rates);
  if (target.minor === null || target.minor <= 0) {
    return { record, state: GOAL_STATE.NO_TARGET, reason: target.reason };
  }

  const saved = valueInBase(record, base, rates);
  const savedMinor = saved.minor ?? 0;
  const remainingMinor = Math.max(0, target.minor - savedMinor);
  const share = Math.min(1, savedMinor / target.minor);

  if (remainingMinor === 0) {
    return { record, state: GOAL_STATE.REACHED, targetMinor: target.minor, savedMinor, share: 1, remainingMinor: 0 };
  }

  const today = now.toISOString().slice(0, 10);

  if (!record.targetDate) {
    return {
      record, state: GOAL_STATE.NO_DEADLINE,
      targetMinor: target.minor, savedMinor, remainingMinor, share
    };
  }

  const monthsLeft = monthsBetween(today, record.targetDate);
  if (monthsLeft === null) {
    return { record, state: GOAL_STATE.NO_DEADLINE, targetMinor: target.minor, savedMinor, remainingMinor, share };
  }

  /* Past the date and short of the target: behind, and by a known amount. */
  if (monthsLeft <= 0) {
    return {
      record, state: GOAL_STATE.BEHIND, targetMinor: target.minor, savedMinor, remainingMinor, share,
      monthsLeft: 0, neededPerMonthMinor: remainingMinor, overdue: true
    };
  }

  const neededPerMonthMinor = Math.ceil(remainingMinor / monthsLeft);

  /* The pace actually achieved so far, when there is a start date to measure
     from. Without one there is nothing to compare against, and a guess would
     be worse than silence. */
  let achievedPerMonthMinor = null;
  if (record.date) {
    const monthsElapsed = monthsBetween(record.date, today);
    if (monthsElapsed !== null && monthsElapsed >= 1 && savedMinor > 0) {
      achievedPerMonthMinor = Math.round(savedMinor / monthsElapsed);
    }
  }

  const state = achievedPerMonthMinor !== null && achievedPerMonthMinor < neededPerMonthMinor
    ? GOAL_STATE.BEHIND
    : GOAL_STATE.ON_TRACK;

  return {
    record, state, targetMinor: target.minor, savedMinor, remainingMinor, share,
    monthsLeft, neededPerMonthMinor, achievedPerMonthMinor, overdue: false
  };
}

/* Active goals, nearest deadline first, then largest shortfall. */
export function goalsOverview(records, base, rates, options = {}) {
  const measured = records
    .filter((record) => record.type === "goal" && !record.deletedAt)
    .filter((record) => !["archived", "done"].includes(record.status))
    .map((record) => goalProgress(record, base, rates, options))
    .filter(Boolean);

  return measured.sort((a, b) => {
    if (a.state === GOAL_STATE.REACHED && b.state !== GOAL_STATE.REACHED) return 1;
    if (b.state === GOAL_STATE.REACHED && a.state !== GOAL_STATE.REACHED) return -1;
    const aDate = a.record.targetDate || "9999-12-31";
    const bDate = b.record.targetDate || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (b.remainingMinor || 0) - (a.remainingMinor || 0);
  });
}

/* What all the goals together still need. Useful next to the budget: money
   committed to a goal is not money available to spend. */
export function totalOutstanding(overview) {
  return overview
    .filter((item) => item.state !== GOAL_STATE.REACHED && Number.isFinite(item.remainingMinor))
    .reduce((sum, item) => sum + item.remainingMinor, 0);
}

export const GOAL_NOTE = {
  ru: "Цель не входит в чистый капитал: деньги уже посчитаны там, где лежат, а второй раз считать их нельзя. «Нужно в месяц» — это остаток, делённый на месяцы до срока, а не совет.",
  en: "A goal is not counted in net worth: the money is already counted where it sits, and counting it twice would inflate the total. \"Per month\" is simply the shortfall divided by the months remaining, not advice."
};
