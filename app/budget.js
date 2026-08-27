/* How much is left to spend this month.
 *
 * The app has always shown what was earned and what was spent. Neither answers
 * the question actually asked in a shop, which is whether this purchase is
 * fine. That needs three things the balance does not carry: a limit, how much
 * of it is gone, and how many days it still has to cover.
 *
 * Everything here is arithmetic over records that already exist — no new
 * bookkeeping, no separate ledger to keep in step. The limit is the only thing
 * the owner supplies.
 *
 * Two deliberate refusals:
 *
 *   It never invents a limit. An unset budget stays unset. What it will do is
 *   report the average of recent months, clearly labelled as an observation,
 *   so the owner has a real number to start from instead of a guess.
 *
 *   It never hides money it could not count. Cashflow already reports what it
 *   excluded and why; that count is carried through, because "осталось 40 000"
 *   is a different statement when three expenses were not counted. */

import { cashflow, periodRange, monthKey } from "./finance.js?v=20260827-144201";

export const BUDGET_STATE = {
  UNSET: "unset",
  UNDER: "under",
  CLOSE: "close",
  OVER: "over"
};

const DAY = 86_400_000;

/* Days remaining in the month, counting today as still spendable. */
function daysLeftInMonth(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return Math.max(1, Math.ceil((end - now) / DAY));
}

const daysInMonth = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

/* What the last few complete months actually cost. Offered as a starting
   point for a limit — an observation about the past, not a recommendation. */
export function typicalMonthlySpend(records, base, rates, { months = 3 } = {}) {
  const totals = [];
  for (let offset = 1; offset <= months; offset += 1) {
    const range = periodRange("month", -offset);
    const flow = cashflow(records, base, rates, range);
    /* A month with nothing in it is a month that was not tracked, not a month
       that cost nothing — averaging it in would understate the figure. */
    if (flow.expenseRecords.length) totals.push(flow.expenseMinor);
  }
  if (!totals.length) return null;

  const average = Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  return { averageMinor: average, months: totals.length };
}

/* The state of this month against the limit. */
export function budgetStatus(records, base, rates, settings, { now = new Date() } = {}) {
  const limitMinor = Number(settings?.budgetMinor) || 0;
  const range = periodRange("month", 0);
  const flow = cashflow(records, base, rates, range);

  const spentMinor = flow.expenseMinor;
  const daysLeft = daysLeftInMonth(now);
  const daysTotal = daysInMonth(now);
  const daysGone = daysTotal - daysLeft;

  if (!limitMinor) {
    return {
      state: BUDGET_STATE.UNSET,
      spentMinor,
      daysLeft,
      excludedCount: flow.excludedCount,
      byCategory: flow.byCategory,
      suggestion: typicalMonthlySpend(records, base, rates)
    };
  }

  const remainingMinor = limitMinor - spentMinor;
  const share = spentMinor / limitMinor;

  /* "Ahead of pace" only means anything against the calendar: spending 60% of
     a budget is fine on the 20th and not on the 5th. */
  const expectedShare = daysTotal ? daysGone / daysTotal : 0;
  const ahead = share > expectedShare + 0.1;

  const state = remainingMinor < 0
    ? BUDGET_STATE.OVER
    : (share >= 0.9 ? BUDGET_STATE.CLOSE : BUDGET_STATE.UNDER);

  return {
    state,
    limitMinor,
    spentMinor,
    remainingMinor,
    share,
    expectedShare,
    ahead,
    daysLeft,
    daysTotal,
    /* What is left per remaining day — the number that answers the question
       in the shop. Negative when the budget is already gone. */
    perDayMinor: Math.round(remainingMinor / daysLeft),
    excludedCount: flow.excludedCount,
    byCategory: flow.byCategory,
    monthKey: monthKey(now.toISOString().slice(0, 10))
  };
}

export const BUDGET_NOTE = {
  ru: "Считается по расходам за текущий месяц, которые Nik'Os смог посчитать. Неподтверждённые записи и записи без курса в сумму не входят — их число показано отдельно.",
  en: "Counted from this month's expenses that Nik'Os could actually value. Unconfirmed records and records with no rate are left out, and their number is shown separately."
};
