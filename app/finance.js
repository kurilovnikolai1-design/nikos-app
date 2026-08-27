/* Every number the owner is asked to trust is produced here, together with
   the list of what was left out and why.

   The old build showed "—" whenever anything went wrong and gave no reason:
   a month of income and expenses could be entered and the totals stayed empty
   because the default status excluded them. Nothing is dropped in silence now. */

import { BALANCE_ROLE, TYPES, isLive, COUNTS_AS_VERIFIED, FREQUENCY } from "./schema.js?v=20260827-122205";
import { convertMinor, cryptoValueMinorUsd, rubPerUnit } from "./rates.js?v=20260827-122205";

export const EXCLUSION = {
  UNCONFIRMED: "unconfirmed",
  NO_AMOUNT: "no-amount",
  NO_RATE: "no-rate",
  NO_PRICE: "no-price"
};

/* Resolve one record to a value in the base currency, or explain why not. */
export function valueInBase(record, base, rates) {
  if (record.type === "crypto") {
    const usdMinor = cryptoValueMinorUsd(record.quantity, record.coin, rates);
    if (usdMinor === null) {
      // A manual valuation is still acceptable when the coin is not priced.
      if (record.amountMinor !== null && record.amountMinor !== undefined) {
        const converted = convertMinor(record.amountMinor, record.currency || "USD", base, rates);
        return converted === null
          ? { minor: null, reason: EXCLUSION.NO_RATE }
          : { minor: converted, manual: true };
      }
      return { minor: null, reason: EXCLUSION.NO_PRICE };
    }
    const converted = convertMinor(usdMinor, "USD", base, rates);
    return converted === null ? { minor: null, reason: EXCLUSION.NO_RATE } : { minor: converted };
  }

  if (record.amountMinor === null || record.amountMinor === undefined) {
    return { minor: null, reason: EXCLUSION.NO_AMOUNT };
  }

  const converted = convertMinor(record.amountMinor, record.currency || base, base, rates);
  if (converted === null) return { minor: null, reason: EXCLUSION.NO_RATE };

  // A part-owned asset counts only for the share actually owned.
  const share = Number(record.ownershipPercent);
  const scaled = Number.isFinite(share) && share > 0 && share < 100
    ? Math.round((converted * share) / 100)
    : converted;

  return { minor: scaled };
}

function emptyExclusions() {
  return { [EXCLUSION.UNCONFIRMED]: [], [EXCLUSION.NO_AMOUNT]: [], [EXCLUSION.NO_RATE]: [], [EXCLUSION.NO_PRICE]: [] };
}

/* ---------- Net worth ---------- */

export function netWorth(records, base, rates) {
  const buckets = { liquid: 0, invested: 0, crypto: 0, property: 0, receivable: 0, liability: 0 };
  const excluded = emptyExclusions();
  const counted = [];

  for (const record of records) {
    if (!isLive(record)) continue;
    const def = TYPES[record.type];
    if (!def || def.role === BALANCE_ROLE.NONE || def.role === BALANCE_ROLE.FLOW) continue;

    if (!COUNTS_AS_VERIFIED.has(record.status)) { excluded[EXCLUSION.UNCONFIRMED].push(record); continue; }

    const value = valueInBase(record, base, rates);
    if (value.minor === null) { excluded[value.reason].push(record); continue; }

    counted.push({ record, minor: value.minor });

    if (def.role === BALANCE_ROLE.LIABILITY) buckets.liability += value.minor;
    else if (record.type === "account") buckets.liquid += value.minor;
    else if (record.type === "investment") buckets.invested += value.minor;
    else if (record.type === "crypto") buckets.crypto += value.minor;
    else if (record.type === "receivable") buckets.receivable += value.minor;
    else buckets.property += value.minor;
  }

  const gross = buckets.liquid + buckets.invested + buckets.crypto + buckets.property + buckets.receivable;
  const totalMinor = gross - buckets.liability;

  const considered = counted.length + excluded[EXCLUSION.UNCONFIRMED].length
    + excluded[EXCLUSION.NO_AMOUNT].length + excluded[EXCLUSION.NO_RATE].length + excluded[EXCLUSION.NO_PRICE].length;

  return {
    base,
    totalMinor,
    grossMinor: gross,
    liabilityMinor: buckets.liability,
    buckets,
    counted,
    excluded,
    excludedCount: considered - counted.length,
    confidence: considered ? Math.round((counted.length / considered) * 100) : null,
    hasAnything: considered > 0
  };
}

/* ---------- Cashflow ---------- */

export const monthKey = (date) => {
  const value = date instanceof Date ? date : new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? null : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
};

export const currentMonthKey = () => monthKey(new Date());

export function periodRange(period, offset = 0) {
  const now = new Date();
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { start, end: new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999) };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear() + offset, 0, 1);
    return { start, end: new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59, 999) };
  }
  if (period === "week") {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
    return { start: monday, end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999) };
  }
  return { start: new Date(1970, 0, 1), end: new Date(3000, 0, 1) };
}

export const inRange = (dateString, range) => {
  if (!dateString) return false;
  const date = new Date(`${dateString}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
};

export function cashflow(records, base, rates, range) {
  const excluded = emptyExclusions();
  let incomeMinor = 0;
  let expenseMinor = 0;
  const incomeRecords = [];
  const expenseRecords = [];
  const byCategory = new Map();

  for (const record of records) {
    if (!isLive(record)) continue;
    if (record.type !== "income" && record.type !== "expense") continue;
    if (record.recurring) continue;                 // templates are not actual money moved
    if (range && !inRange(record.date, range)) continue;

    (record.type === "income" ? incomeRecords : expenseRecords).push(record);

    if (!COUNTS_AS_VERIFIED.has(record.status)) { excluded[EXCLUSION.UNCONFIRMED].push(record); continue; }

    const value = valueInBase(record, base, rates);
    if (value.minor === null) { excluded[value.reason].push(record); continue; }

    if (record.type === "income") incomeMinor += value.minor;
    else {
      expenseMinor += value.minor;
      const key = record.category || "other";
      byCategory.set(key, (byCategory.get(key) || 0) + value.minor);
    }
  }

  return {
    base,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    incomeRecords,
    expenseRecords,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    excluded,
    excludedCount: Object.values(excluded).reduce((sum, list) => sum + list.length, 0)
  };
}

/* ---------- Recurring obligations ---------- */

export const monthlyEquivalentMinor = (record, base, rates) => {
  const value = valueInBase(record, base, rates);
  if (value.minor === null) return null;
  const perMonth = FREQUENCY[record.frequency]?.perMonth ?? 1;
  return Math.round(value.minor * perMonth);
};

export function recurringLoad(records, base, rates) {
  const active = records.filter((record) =>
    isLive(record) && record.recurring && (record.type === "expense" || record.type === "income") && record.status !== "archived");

  let expenseMinor = 0;
  let incomeMinor = 0;
  const noRate = [];

  for (const record of active) {
    const minor = monthlyEquivalentMinor(record, base, rates);
    if (minor === null) { noRate.push(record); continue; }
    if (record.type === "expense") expenseMinor += minor;
    else incomeMinor += minor;
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const dueSoon = active.filter((record) => {
    const due = record.nextDueDate || record.date;
    if (!due) return false;
    const date = new Date(`${due}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date <= horizon;
  });

  return { active, expenseMinor, incomeMinor, netMinor: incomeMinor - expenseMinor, dueSoon, noRate };
}

/* ---------- Sport & health ---------- */

export function sportSummary(records, range) {
  const workouts = records.filter((record) =>
    isLive(record) && record.type === "workout" && record.status === "done" && (!range || inRange(record.date, range)));

  const minutes = workouts.reduce((sum, record) => sum + (Number(record.duration) || 0), 0);
  const distance = workouts.reduce((sum, record) => sum + (Number(record.distance) || 0), 0);

  const measurements = records.filter((record) => isLive(record) && record.type === "measurement");
  const series = (category) => measurements
    .filter((record) => record.category === category && Number.isFinite(Number(record.value)) && record.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({ date: record.date, value: Number(record.value) }));

  const weight = series("weight");
  const first = weight[0]?.value ?? null;
  const last = weight.at(-1)?.value ?? null;

  return {
    workouts,
    count: workouts.length,
    minutes,
    hours: minutes / 60,
    distance,
    weight: { series: weight, latest: last, change: first !== null && last !== null ? last - first : null },
    sleep: series("sleep"),
    rhr: series("rhr"),
    streak: workoutStreak(records)
  };
}

/* Consecutive days ending today (or yesterday) with at least one workout. */
function workoutStreak(records) {
  const days = new Set(records
    .filter((record) => isLive(record) && record.type === "workout" && record.status === "done" && record.date)
    .map((record) => record.date));
  if (!days.size) return 0;

  const cursor = new Date();
  const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------- Snapshot ---------- */

export function buildSnapshot(records, base, rates) {
  const worth = netWorth(records, base, rates);
  if (!worth.counted.length) return null;
  return {
    totalMinor: worth.totalMinor,
    base,
    buckets: worth.buckets,
    countedIds: worth.counted.map((entry) => entry.record.id),
    excludedCount: worth.excludedCount,
    confidence: worth.confidence,
    rateSource: rates?.source || null,
    rateFetchedAt: rates?.fetchedAt || null,
    ratesUsed: Object.fromEntries([...new Set(worth.counted.map((entry) => entry.record.currency || base))]
      .map((code) => [code, rubPerUnit(rates, code)]))
  };
}
