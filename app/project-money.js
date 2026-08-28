/* What each project actually costs and brings in.
 *
 * A project screen that shows only progress and a deadline answers the
 * smaller half of the question. For anything run as a business — a site, a
 * venture, a piece of work someone pays for — the question is whether it is
 * ahead or behind, and that needs the money attached to it.
 *
 * No new bookkeeping: an income or an expense is tied to a project through
 * the link that already exists between records. So the same expense counts
 * once in the cashflow and once against the project it belongs to, and there
 * is no second set of numbers to keep in step with the first.
 *
 * The same honesty as everywhere else in the money code: anything that could
 * not be valued is counted and reported rather than quietly skipped, because
 * "проект в плюсе" is a different statement when two expenses were dropped. */

import { valueInBase, EXCLUSION } from "./finance.js?v=20260827-172331";

const COUNTS = new Set(["confirmed", "active", "done", "closed"]);

const isLive = (record) => !record.deletedAt;

/* Records the owner has linked to this project, in either direction: a link
   drawn from the expense to the project should count the same as one drawn
   the other way, because to the person drawing it they are the same act. */
function linkedTo(projectId, records) {
  const project = records.find((record) => record.id === projectId);
  const outward = new Set(project?.linkedIds || []);

  return records.filter((record) =>
    isLive(record)
    && (record.type === "income" || record.type === "expense")
    && (outward.has(record.id) || (record.linkedIds || []).includes(projectId)));
}

/* One project's money. */
export function projectMoney(project, records, base, rates) {
  const attached = linkedTo(project.id, records);

  let incomeMinor = 0;
  let expenseMinor = 0;
  let skipped = 0;

  for (const record of attached) {
    if (record.recurring) continue;             /* a template, not money moved */
    if (!COUNTS.has(record.status)) { skipped += 1; continue; }

    const value = valueInBase(record, base, rates);
    if (value.minor === null) { skipped += 1; continue; }

    if (record.type === "income") incomeMinor += value.minor;
    else expenseMinor += value.minor;
  }

  const netMinor = incomeMinor - expenseMinor;

  return {
    project,
    incomeMinor,
    expenseMinor,
    netMinor,
    /* Only meaningful once something was spent: a project with income and no
       costs has no return to speak of, it just has income. */
    returnPercent: expenseMinor > 0 ? (netMinor / expenseMinor) * 100 : null,
    entries: attached.length,
    skipped,
    state: netMinor > 0 ? "profit" : netMinor < 0 ? "loss" : "even"
  };
}

/* Every project with money attached, biggest result first. Projects with
   nothing linked are left out — an empty row per project would bury the ones
   that matter. */
export function projectsWithMoney(records, base, rates) {
  return records
    .filter((record) => record.type === "project" && isLive(record))
    .map((project) => projectMoney(project, records, base, rates))
    .filter((entry) => entry.entries > 0)
    .sort((a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor));
}

export function projectTotals(list) {
  return list.reduce((sum, entry) => ({
    incomeMinor: sum.incomeMinor + entry.incomeMinor,
    expenseMinor: sum.expenseMinor + entry.expenseMinor,
    netMinor: sum.netMinor + entry.netMinor,
    skipped: sum.skipped + entry.skipped
  }), { incomeMinor: 0, expenseMinor: 0, netMinor: 0, skipped: 0 });
}

export const PROJECT_MONEY_NOTE = {
  ru: "Считаются доходы и расходы, связанные с проектом через «Связи» в записи. Это те же самые записи, что и в денежном потоке, — второй бухгалтерии здесь нет.",
  en: "Counted from income and expenses linked to the project through a record's links. These are the same records as in the cashflow — there is no second ledger."
};

export { EXCLUSION };
