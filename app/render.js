/* Record rows and lists.

   The old renderRecordList() sliced every list to the last eight records with
   no counter and no way to reach the rest, so an owner with twenty accounts
   simply could not see twelve of them. Here a list always states how many
   records it holds and can always show all of them. */

import { el, emptyState, confirmDialog, toast } from "./ui.js?v=20260827-172643";
import { t, getLocale, statusLabel, statusTone, categoryLabel, typeLabel, ownerLabel,
         confidenceLabel, formatDate, relativeDays, formatNumber, countOf, PLURALS } from "./i18n.js?v=20260827-172643";
import { TYPES, isVerified, BALANCE_ROLE } from "./schema.js?v=20260827-172643";
import { formatMoney, formatQuantity } from "./money.js?v=20260827-172643";
import { cryptoUsdPrice } from "./rates.js?v=20260827-172643";
import * as store from "./store.js?v=20260827-172643";
import * as records from "./records.js?v=20260827-172643";
import { openRecordForm } from "./form.js?v=20260827-172643";

const PAGE_SIZE = 8;
const expanded = new Set();

export function refresh() {
  document.dispatchEvent(new CustomEvent("nikos:refresh"));
}

/* ---------- One row ---------- */

export function recordRow(record, { compact = false, onChange = refresh } = {}) {
  const def = TYPES[record.type];
  const verified = isVerified(record);
  const money = def?.role === BALANCE_ROLE.ASSET || def?.role === BALANCE_ROLE.LIABILITY || def?.role === BALANCE_ROLE.FLOW;

  const row = el("div", {
    class: `record-row${record.status === "archived" ? " is-archived" : ""}`,
    dataset: { recordId: record.id, recordType: record.type }
  });

  row.append(el("span", { class: "record-icon", "aria-hidden": "true", text: def?.icon || "◈" }));

  const meta = [];
  if (record.counterparty) meta.push(record.counterparty);
  if (record.date) meta.push(formatDate(record.date, "short"));
  if (record.owner && record.owner !== "me") meta.push(ownerLabel(record.owner));
  if (record.terms) meta.push(record.terms);
  if (record.recurring) meta.push(t("form.recurrence").toLowerCase());

  const main = el("span", { class: "record-main" }, [
    el("strong", { text: record.name }),
    el("small", { class: "record-sub" }, [
      el("span", { text: categoryLabel(record.type, record.category) }),
      meta.length ? el("span", { class: "record-dots", text: ` · ${meta.join(" · ")}` }) : null
    ]),
    !compact && record.details ? el("small", { class: "record-note", text: truncate(record.details, 120) }) : null
  ]);
  row.append(main);

  row.append(el("span", { class: "record-amount" }, [
    el("b", { text: amountText(record) }),
    el("span", { class: `record-status tone-${statusTone(record.status)}`, text: statusLabel(record.status) }),
    money && !verified ? el("small", { class: "record-excluded", text: t("rec.needsConfirmation") }) : null
  ]));

  const actions = el("span", { class: "record-actions" });

  if (!verified && record.status !== "archived" && def?.statuses.some((s) => ["confirmed", "active", "done", "paid"].includes(s))) {
    actions.append(iconButton("✓", t("app.confirm"), async () => {
      const result = await records.confirmRecord(record.id);
      if (result.ok) { toast(t("rec.confirmed"), { tone: "success" }); onChange(); }
    }, "confirm"));
  }

  actions.append(iconButton("✎", t("app.edit"), () => {
    openRecordForm(record.type, record, { onSaved: onChange });
  }));

  actions.append(iconButton(record.status === "archived" ? "↺" : "⌁",
    record.status === "archived" ? t("app.restore") : t("app.archive"), async () => {
      const result = record.status === "archived"
        ? await records.unarchiveRecord(record.id)
        : await records.archiveRecord(record.id);
      if (!result.ok) return;
      onChange();
      toast(record.status === "archived" ? t("app.restore") : t("rec.archived"), {
        action: store.canUndo()
          ? { label: t("rec.undo"), run: async () => { await store.undoLast(); onChange(); } }
          : null
      });
    }));

  actions.append(iconButton("✕", t("app.delete"), async () => {
    const confirmed = await confirmDialog({
      title: t("app.delete"), message: t("rec.confirmDelete"),
      detail: record.name, confirmLabel: t("app.delete"), tone: "danger"
    });
    if (!confirmed) return;
    const result = await records.deleteRecord(record.id);
    if (!result.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }
    onChange();
    // Soft delete, so an accidental click is one tap away from being undone.
    toast(t("rec.deleted"), {
      tone: "info",
      action: { label: t("rec.undo"), run: async () => { await records.restoreRecord(record.id); onChange(); } }
    });
  }, "danger"));

  row.append(actions);
  return row;
}

function amountText(record) {
  if (record.type === "crypto") {
    const price = cryptoUsdPrice(store.getRates(), record.coin);
    if (record.quantity !== null && record.quantity !== undefined) {
      const quantity = formatQuantity(record.quantity, record.coin || "", getLocale());
      return price ? `${quantity} · ${formatMoney(Math.round(Number(record.quantity) * price * 100), "USD", getLocale())}` : quantity;
    }
    return record.amountMinor !== null ? formatMoney(record.amountMinor, record.currency || "USD", getLocale()) : "—";
  }
  if (record.type === "measurement") {
    return record.value === null || record.value === undefined ? "—" : formatNumber(record.value, 2);
  }
  if (record.type === "workout") {
    const bits = [];
    if (record.duration) bits.push(`${formatNumber(record.duration)} ${getLocale() === "ru" ? "мин" : "min"}`);
    if (record.distance) bits.push(`${formatNumber(record.distance, 1)} ${getLocale() === "ru" ? "км" : "km"}`);
    return bits.join(" · ") || "—";
  }
  if (record.type === "task" || record.type === "project" || record.type === "note"
      || record.type === "person" || record.type === "decision" || record.type === "event" || record.type === "document") {
    return record.dueTime || (record.date ? relativeDays(record.date) : "—");
  }
  if (record.amountMinor === null || record.amountMinor === undefined) return "—";
  const sign = TYPES[record.type]?.role === BALANCE_ROLE.LIABILITY || record.type === "expense" ? -1 : 1;
  return formatMoney(sign * record.amountMinor, record.currency || "RUB", getLocale());
}

const iconButton = (glyph, label, onClick, extra = "") =>
  el("button", {
    class: `small-button record-action ${extra}`.trim(), type: "button",
    "aria-label": label, title: label, text: glyph, onclick: onClick
  });

const truncate = (text, max) => (String(text).length > max ? `${String(text).slice(0, max)}…` : String(text));

/* ---------- A list that never hides records without saying so ---------- */

export function recordList(key, items, { empty, addType = null, addLabel = null, onChange = refresh, compact = false } = {}) {
  const host = el("div", { class: "record-list", dataset: { list: key } });

  if (!items.length) {
    host.append(emptyState(empty || t("rec.empty"),
      addType ? (addLabel || `${t("app.add")}: ${typeLabel(addType).toLowerCase()}`) : null,
      addType ? () => openRecordForm(addType, null, { onSaved: onChange }) : null));
    return host;
  }

  const isOpen = expanded.has(key);
  const shown = isOpen ? items : items.slice(0, PAGE_SIZE);

  for (const record of shown) host.append(recordRow(record, { compact, onChange }));

  if (items.length > PAGE_SIZE) {
    host.append(el("div", { class: "list-footer" }, [
      el("span", { class: "muted-text", text: isOpen
        ? countOf(items.length, PLURALS.record)
        : `${shown.length} ${t("app.of")} ${countOf(items.length, PLURALS.record)}` }),
      el("button", {
        class: "text-button", type: "button",
        text: isOpen ? t("app.showLess") : `${t("app.showAll")} (${items.length}) →`,
        onclick: () => { if (isOpen) expanded.delete(key); else expanded.add(key); onChange(); }
      })
    ]));
  } else {
    host.append(el("div", { class: "list-footer" }, [
      el("span", { class: "muted-text", text: countOf(items.length, PLURALS.record) })
    ]));
  }

  return host;
}

/* ---------- Shared blocks ---------- */

export const addButton = (type, label = null, onChange = refresh, className = "primary-button") =>
  el("button", {
    class: className, type: "button",
    onclick: () => openRecordForm(type, null, { onSaved: onChange })
  }, [el("span", { text: "＋" }), ` ${label || typeLabel(type)}`]);

export const pageHeading = (title, lede, actions = null, eyebrow = null) =>
  el("div", { class: "page-heading" }, [
    el("div", {}, [
      eyebrow ? el("div", { class: "eyebrow", text: eyebrow }) : null,
      el("h1", {}, [title, el("span", { class: "accent-dot", text: "." })]),
      lede ? el("p", { class: "lede", text: lede }) : null
    ]),
    actions ? el("div", { class: "button-row" }, [actions].flat().filter(Boolean)) : null
  ]);

/* An honest footnote under any total: what was left out, and why. */
export function exclusionNote(excluded) {
  const parts = [];
  const push = (list, ru, en) => { if (list?.length) parts.push(`${list.length} ${getLocale() === "ru" ? ru : en}`); };
  push(excluded.unconfirmed, "не подтверждено", "unconfirmed");
  push(excluded["no-amount"], "без суммы", "without an amount");
  push(excluded["no-rate"], "без курса", "without a rate");
  push(excluded["no-price"], "без цены", "without a price");
  if (!parts.length) return null;
  return el("small", { class: "exclusion-note", text: `${getLocale() === "ru" ? "Не в расчёте" : "Excluded"}: ${parts.join(", ")}` });
}

/* Filter chips carry values in data, never in their visible label — the old
   build compared translated button text and broke on every language switch. */
export function chipRow(options, activeValue, onPick) {
  return el("div", { class: "filter-row" }, options.map((item) =>
    el("button", {
      class: `filter-chip${item.value === activeValue ? " selected" : ""}`,
      type: "button", dataset: { value: item.value }, onclick: () => onPick(item.value)
    }, [item.label, item.count !== undefined ? el("b", { text: String(item.count) }) : null])));
}

export function sparkline(series, { width = 220, height = 44, tone = "green" } = {}) {
  if (!series || series.length < 2) return null;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (series.length - 1);
  const points = series.map((point, index) =>
    `${(index * step).toFixed(1)},${(height - ((point.value - min) / span) * (height - 6) - 3).toFixed(1)}`).join(" ");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", `sparkline tone-${tone}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.append(line);

  return svg;
}

export { PAGE_SIZE, expanded };
