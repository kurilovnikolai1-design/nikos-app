/* What a thing costs to keep.
 *
 * An asset screen shows what something is worth. That is the smaller half of
 * owning it: a car is a purchase price once and fuel, insurance, servicing and
 * parking every month afterwards, and only the second number tells you whether
 * keeping it makes sense.
 *
 * Costs are attached the same way project money is — through the link already
 * drawn between records — so nothing new has to be maintained and an expense
 * counts once in the cashflow and once against the thing it was spent on.
 *
 * Two figures, kept apart on purpose:
 *
 *   What it has cost in total, since the first linked expense. Simple and
 *   unarguable.
 *
 *   What it costs a month, over the period actually covered. This is the
 *   useful one and the easy one to get wrong: dividing by a fixed twelve
 *   months would understate a car bought in March, so the divisor is the span
 *   between the first and last expense, and it is never less than a month. */

import { valueInBase } from "./finance.js?v=20260828-004404";

const DAY = 86_400_000;
const MONTH_DAYS = 30.44;
const COUNTS = new Set(["confirmed", "active", "done", "paid"]);

const isLive = (record) => !record.deletedAt;

function linkedExpenses(assetId, records) {
  const asset = records.find((record) => record.id === assetId);
  const outward = new Set(asset?.linkedIds || []);

  return records.filter((record) =>
    isLive(record)
    && record.type === "expense"
    && !record.recurring
    && (outward.has(record.id) || (record.linkedIds || []).includes(assetId)));
}

export function assetCost(asset, records, base, rates, { now = Date.now() } = {}) {
  const expenses = linkedExpenses(asset.id, records);

  let totalMinor = 0;
  let skipped = 0;
  const byCategory = new Map();
  const dates = [];

  for (const record of expenses) {
    if (!COUNTS.has(record.status)) { skipped += 1; continue; }
    const value = valueInBase(record, base, rates);
    if (value.minor === null) { skipped += 1; continue; }

    totalMinor += value.minor;
    if (record.date) dates.push(record.date);
    const key = record.category || "other";
    byCategory.set(key, (byCategory.get(key) || 0) + value.minor);
  }

  dates.sort();
  const first = dates[0] || null;
  const last = dates.at(-1) || null;

  /* The span the spending actually covers, from the first expense to today —
     not to the last expense, because a quiet month is still a month of
     ownership and pretending otherwise flatters the figure. */
  let months = null;
  if (first) {
    const span = (now - new Date(`${first}T12:00:00`).getTime()) / DAY / MONTH_DAYS;
    months = Math.max(1, span);
  }

  const value = valueInBase(asset, base, rates);

  return {
    asset,
    totalMinor,
    perMonthMinor: months ? Math.round(totalMinor / months) : null,
    months: months ? Math.round(months) : null,
    firstSpend: first,
    lastSpend: last,
    entries: expenses.length,
    skipped,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    valueMinor: value.minor,
    /* Upkeep as a share of what the thing is worth — a fair way to compare a
       car with a flat, which cost wildly different absolute amounts. */
    annualSharePercent: value.minor && months
      ? ((totalMinor / months) * 12 / value.minor) * 100
      : null
  };
}

export function assetsWithCosts(records, base, rates, options = {}) {
  return records
    .filter((record) => record.type === "asset" && isLive(record))
    .map((asset) => assetCost(asset, records, base, rates, options))
    .filter((entry) => entry.entries > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export const ASSET_COST_NOTE = {
  ru: "Считаются расходы, связанные с имуществом через «Связи» в записи. В месяц — это всё потраченное, делённое на срок с первой траты по сегодня, поэтому цифра растёт медленнее, чем кажется, и не скачет от одного крупного ремонта.",
  en: "Counted from expenses linked to the asset through a record's links. The monthly figure divides everything spent by the span from the first expense to today, so one large repair does not distort it."
};
