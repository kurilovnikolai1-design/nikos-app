/* The attention engine.

   The old Command Center showed three invented rows that could not be dismissed
   or acted on. These signals are derived from the owner's own records, each one
   points at the record that produced it, and the count in the sidebar is the
   number of real things waiting. MASTER_SPEC §13.2. */

import { t, getLocale, formatDate, relativeDays, countOf, PLURALS } from "./i18n.js?v=20260827-101457";
import { isLive, TYPES, COUNTS_AS_VERIFIED, BALANCE_ROLE } from "./schema.js?v=20260827-101457";
import { isStale } from "./rates.js?v=20260827-101457";

const DAY = 86_400_000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date - startOfToday()) / DAY);
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export function buildAttention(state, { rates, settings }) {
  const items = [];
  const live = state.records.filter(isLive);
  const ru = getLocale() === "ru";

  const add = (item) => items.push(item);

  for (const record of live) {
    /* Tasks */
    if (record.type === "task" && record.status !== "done") {
      const days = daysUntil(record.date);
      if (days !== null && days < 0) {
        add({ id: `task-late-${record.id}`, severity: "critical", marker: "!",
              title: t("att.overdueTask"), detail: `${record.name} · ${relativeDays(record.date)}`,
              recordId: record.id, view: "tasks", weight: 100 - days });
      } else if (days === 0) {
        add({ id: `task-today-${record.id}`, severity: record.priority === "high" ? "warning" : "info", marker: "✓",
              title: t("att.todayTask"), detail: record.name, recordId: record.id, view: "tasks", weight: 60 });
      }
    }

    /* Money owed, in both directions */
    if ((record.type === "payable" || record.type === "receivable") && !["paid", "closed"].includes(record.status)) {
      const days = daysUntil(record.dueDate || record.nextDueDate);
      if (days !== null && days < 0) {
        add({ id: `debt-late-${record.id}`, severity: "critical", marker: "!",
              title: record.type === "payable" ? t("att.paymentOverdue") : t("att.debtDue"),
              detail: `${record.name} · ${formatDate(record.dueDate, "short")}`,
              recordId: record.id, view: "debts", weight: 120 - days });
      } else if (days !== null && days <= 7) {
        add({ id: `debt-soon-${record.id}`, severity: "warning", marker: "↻",
              title: t("att.paymentDue"), detail: `${record.name} · ${relativeDays(record.dueDate)}`,
              recordId: record.id, view: "debts", weight: 70 });
      }
    }

    /* Recurring obligations */
    if (record.recurring && record.type === "expense" && record.status !== "archived") {
      const days = daysUntil(record.nextDueDate || record.date);
      if (days !== null && days >= 0 && days <= 5) {
        add({ id: `rec-${record.id}`, severity: days <= 1 ? "warning" : "info", marker: "↻",
              title: t("att.paymentDue"), detail: `${record.name} · ${relativeDays(record.nextDueDate || record.date)}`,
              recordId: record.id, view: "cashflow", weight: 65 });
      }
    }

    /* Documents that stop being valid */
    if (record.type === "document" && record.expiresAt) {
      const days = daysUntil(record.expiresAt);
      if (days !== null && days <= 90) {
        add({ id: `doc-${record.id}`, severity: days < 0 ? "critical" : days <= 30 ? "warning" : "info", marker: "▱",
              title: t("att.documentExpiring"), detail: `${record.name} · ${relativeDays(record.expiresAt)}`,
              recordId: record.id, view: "documents", weight: days < 0 ? 110 : 55 });
      }
    }

    /* Decisions and investments waiting on a review date */
    if ((record.type === "decision" || record.type === "investment") && record.reminderDate) {
      const days = daysUntil(record.reminderDate);
      if (days !== null && days <= 0) {
        add({ id: `review-${record.id}`, severity: "warning", marker: "◆",
              title: t("att.reviewDue"), detail: `${record.name} · ${relativeDays(record.reminderDate)}`,
              recordId: record.id, view: record.type === "decision" ? "decisions" : "investments", weight: 75 });
      }
    }

    /* Any other reminder the owner set */
    if (record.reminderDate && !["decision", "investment"].includes(record.type)) {
      const days = daysUntil(record.reminderDate);
      if (days !== null && days <= 0) {
        add({ id: `rem-${record.id}`, severity: days < -3 ? "warning" : "info", marker: "↻",
              title: t("att.reminder"), detail: `${record.name} · ${relativeDays(record.reminderDate)}`,
              recordId: record.id, view: TYPES[record.type]?.view || "command", weight: 50 });
      }
    }
  }

  /* Money that is entered but not counted, which is the single most confusing
     thing a new owner runs into. Surfaced once, with a way to fix it in bulk. */
  const pending = live.filter((record) => {
    const role = TYPES[record.type]?.role;
    return (role === BALANCE_ROLE.ASSET || role === BALANCE_ROLE.LIABILITY || role === BALANCE_ROLE.FLOW)
      && !COUNTS_AS_VERIFIED.has(record.status)
      && record.status !== "archived";
  });
  if (pending.length) {
    add({ id: "pending-confirm", severity: "info", marker: "◉",
          title: `${countOf(pending.length, PLURALS.record)} ${ru ? "ждут подтверждения" : "await confirmation"}`,
          detail: t("att.unconfirmedHint"), action: "confirm-pending", ids: pending.map((r) => r.id),
          view: "capital", weight: 40 });
  }

  /* Housekeeping */
  const hasMoney = live.some((record) => {
    const role = TYPES[record.type]?.role;
    return role === BALANCE_ROLE.ASSET || role === BALANCE_ROLE.LIABILITY;
  });
  const usesForeign = live.some((record) => record.currency && record.currency !== (settings.baseCurrency || "RUB"));
  if (hasMoney && usesForeign && isStale(rates)) {
    add({ id: "rates-stale", severity: "info", marker: "⇅", title: t("att.staleRates"),
          detail: rates?.fetchedAt ? formatDate(rates.fetchedAt, "short") : t("app.notSet"),
          action: "refresh-rates", view: "settings", weight: 30 });
  }

  if (live.length >= 10) {
    const last = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
    if (Date.now() - last > 14 * DAY) {
      add({ id: "backup-old", severity: "info", marker: "↓", title: t("att.noBackup"),
            detail: settings.lastBackupAt ? formatDate(settings.lastBackupAt, "short") : (ru ? "никогда" : "never"),
            action: "export", view: "settings", weight: 20 });
    }
  }

  items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.weight - a.weight);
  return items;
}

export const criticalCount = (items) => items.filter((item) => item.severity === "critical").length;
