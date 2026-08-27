/* CSV import for scale and wearable exports.

   Rows land as measurements with a real numeric value and a real date, so they
   feed the weight and sleep trends instead of becoming unreadable text blobs.
   Everything imported stays unconfirmed until the owner accepts it. */

import { el, openDialog, toast } from "./ui.js?v=20260827-150013";
import { t, getLocale, countOf, PLURALS, categoryLabel } from "./i18n.js?v=20260827-150013";
import { categoriesOf } from "./schema.js?v=20260827-150013";
import * as store from "./store.js?v=20260827-150013";
import * as records from "./records.js?v=20260827-150013";
import { parseStatement, BANK_NOTE } from "./bank-import.js?v=20260827-150013";

const ru = () => getLocale() === "ru";
const MAX_ROWS = 2000;

/* Header names seen in WHOOP, Withings, Garmin, Apple Health and Renpho exports. */
const METRIC_HINTS = [
  { category: "weight", re: /(^|[\s_-])(weight|вес|масса|body ?mass)([\s_-]|$)/i, unit: "кг" },
  { category: "bodyfat", re: /(fat ?%|body ?fat|жир)/i, unit: "%" },
  { category: "sleep", re: /(sleep.*(duration|hours|performance)|asleep|сон)/i, unit: "ч" },
  { category: "hrv", re: /(hrv|heart ?rate ?variability|вариабельн)/i, unit: "мс" },
  { category: "rhr", re: /(resting ?heart ?rate|rhr|пульс ?покоя)/i, unit: "уд/мин" },
  { category: "recovery", re: /(recovery|восстановл)/i, unit: "%" },
  { category: "strain", re: /(strain|нагрузка)/i, unit: "" },
  { category: "steps", re: /(steps|шаги)/i, unit: "" }
];

export function parseCsvLine(line, separator) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === separator && !quoted) { cells.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

const detectSeparator = (header) => {
  const counts = [[",", (header.match(/,/g) || []).length], [";", (header.match(/;/g) || []).length], ["\t", (header.match(/\t/g) || []).length]];
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ",";
};

const parseNumber = (text) => {
  const cleaned = String(text).replace(/[\s ]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
};

const parseDate = (text) => {
  const value = String(text).trim();
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (match) return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return null;
};

export function analyseCsv(text, filename) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { error: ru() ? "Нужен заголовок и хотя бы одна строка." : "A header and at least one row are required." };

  const separator = detectSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], separator);
  const dateIndex = headers.findIndex((header) => /date|day|time|дата|день/i.test(header));

  const columns = headers.map((header, index) => {
    const hint = METRIC_HINTS.find((item) => item.re.test(header));
    return { index, header, category: hint?.category || null, unit: hint?.unit || "", selected: Boolean(hint) };
  }).filter((column) => column.index !== dateIndex);

  const rows = lines.slice(1, MAX_ROWS + 1).map((line) => parseCsvLine(line, separator));

  return { headers, columns, dateIndex, rows, separator, filename, total: lines.length - 1 };
}

export function importCsv({ onDone = null } = {}) {
  const picker = el("input", { type: "file", accept: ".csv,text/csv,text/plain", hidden: true });
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.remove();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showPreview(String(reader.result || ""), file.name, onDone);
    reader.onerror = () => toast(ru() ? "Не удалось прочитать файл." : "The file could not be read.", { tone: "danger" });
    reader.readAsText(file);
  });
  document.body.append(picker);
  picker.click();
}

function showPreview(text, filename, onDone) {
  const analysis = analyseCsv(text, filename);
  if (analysis.error) { toast(analysis.error, { tone: "danger" }); return; }

  if (analysis.dateIndex < 0) {
    toast(ru() ? "В файле не найден столбец с датой." : "No date column was found in the file.", { tone: "danger" });
    return;
  }

  const body = el("div", { class: "csv-preview" });
  const dialog = openDialog({
    title: t("health.importCsv"),
    subtitle: `${filename} · ${countOf(analysis.total, PLURALS.row)}`,
    size: "form",
    body,
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: run })
    ])
  });

  render();

  function render() {
    const chosen = analysis.columns.filter((column) => column.selected);
    const estimate = countRows(chosen);

    body.replaceChildren(
      el("p", { class: "csv-hint", text: ru()
        ? "Выберите, какие столбцы сохранить. Каждая пара «дата + значение» станет отдельным показателем со статусом «нужно подтвердить»."
        : "Pick the columns to keep. Each date-and-value pair becomes one measurement, marked as unconfirmed." }),
      el("div", { class: "csv-columns" }, analysis.columns.map((column) => el("label", { class: "csv-column" }, [
        el("input", {
          type: "checkbox", checked: column.selected ? "checked" : null,
          onchange: (event) => { column.selected = event.target.checked; render(); }
        }),
        el("span", { class: "csv-column-name", text: column.header || `#${column.index}` }),
        el("select", {
          class: "form-control compact",
          onchange: (event) => { column.category = event.target.value; render(); }
        }, categoriesOf("measurement").map((item) =>
          el("option", { value: item.key, selected: item.key === (column.category || "other") ? "selected" : null,
                         text: categoryLabel("measurement", item.key) })))
      ]))),
      el("p", { class: "csv-summary", text: ru()
        ? `Будет добавлено записей: ${estimate}`
        : `Records to add: ${estimate}` })
    );
  }

  function countRows(chosen) {
    let count = 0;
    for (const row of analysis.rows) {
      if (!parseDate(row[analysis.dateIndex])) continue;
      for (const column of chosen) if (parseNumber(row[column.index]) !== null) count += 1;
    }
    return count;
  }

  async function run() {
    const chosen = analysis.columns.filter((column) => column.selected);
    if (!chosen.length) { toast(ru() ? "Выберите хотя бы один столбец." : "Select at least one column.", { tone: "warn" }); return; }

    const created = [];
    for (const row of analysis.rows) {
      const date = parseDate(row[analysis.dateIndex]);
      if (!date) continue;
      for (const column of chosen) {
        const value = parseNumber(row[column.index]);
        if (value === null) continue;
        created.push({
          ...records.blankRecord("measurement"),
          category: column.category || "other",
          name: column.header || categoryLabel("measurement", column.category || "other"),
          value,
          date,
          status: "unverified",
          source: filename,
          confidence: "medium"
        });
      }
    }

    if (!created.length) { toast(ru() ? "Подходящих строк не нашлось." : "No usable rows were found.", { tone: "warn" }); return; }

    const result = await store.commit((existing) => existing.concat(created), "csv-imported");
    if (!result.ok) {
      toast(result.reason === "quota" ? t("sec.storageFull") : t("sec.storageFull"), { tone: "danger" });
      return;
    }
    store.pushAudit({ action: "imported", name: `${filename} · ${created.length}` });
    dialog.close();
    toast(ru() ? `Добавлено записей: ${created.length}` : `${created.length} records added`, { tone: "success" });
    onDone?.();
  }
}

/* ---------- Bank statements ---------- */

/* The parser lives in bank-import.js and knows nothing about the DOM; this is
   only the part that shows what it found and lets rows be unticked. Nothing is
   saved until the owner has looked at the list. */
export function openBankImport({ onDone = null } = {}) {
  let parsed = null;

  const input = el("textarea", {
    class: "form-control lab-paste", rows: "8", "data-autofocus": "true",
    placeholder: ru()
      ? "Откройте выписку из банка (CSV) в любом редакторе, скопируйте всё и вставьте сюда.\n\nДата операции;Сумма операции;Валюта;Описание\n27.08.2026;-1 234,56;RUB;ПЯТЕРОЧКА"
      : "Open the bank's CSV statement, copy everything and paste it here.",
    oninput: () => analyse()
  });

  const summary = el("p", { class: "csv-summary" });
  const list = el("div", { class: "bank-rows" });

  const dialog = openDialog({
    title: ru() ? "Импорт выписки" : "Import a statement",
    subtitle: ru() ? "Расходы и поступления из банка" : "Spending and income from a bank",
    size: "form",
    body: el("div", { class: "lab-paste-body" }, [
      input, summary, list,
      el("p", { class: "panel-note", text: ru() ? BANK_NOTE.ru : BANK_NOTE.en })
    ]),
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: save })
    ])
  });

  analyse();
  return dialog;

  function analyse() {
    parsed = parseStatement(input.value);
    list.textContent = "";

    if (!input.value.trim()) { summary.textContent = ""; return; }

    if (!parsed.ok) {
      summary.textContent = parsed.reason === "no-columns"
        ? (ru() ? "Не нашёл столбцы с датой и суммой. Проверьте, что скопировали всю таблицу." : "No date and amount columns found.")
        : (ru() ? "В этом тексте нет строк, похожих на операции." : "No rows that look like transactions.");
      return;
    }

    const income = parsed.rows.filter((row) => row.type === "income").length;
    summary.textContent = ru()
      ? `Нашёл ${countOf(parsed.rows.length, PLURALS.row)}: ${countOf(parsed.rows.length - income, PLURALS.outflow)}, ${countOf(income, PLURALS.inflow)}${parsed.skipped ? `. Пропущено строк: ${parsed.skipped}` : ""}.`
      : `Found ${parsed.rows.length} rows: ${parsed.rows.length - income} out, ${income} in${parsed.skipped ? `. ${parsed.skipped} skipped` : ""}.`;

    for (const row of parsed.rows.slice(0, 200)) {
      const box = el("input", {
        type: "checkbox", checked: row.include ? "checked" : null,
        onchange: (event) => { row.include = event.target.checked; }
      });
      list.append(el("label", { class: `bank-row ${row.type}` }, [
        box,
        el("span", { class: "bank-date", text: row.date }),
        el("span", { class: "bank-name", text: row.name }),
        el("b", { text: `${row.type === "expense" ? "−" : "+"}${(row.amountMinor / 100).toLocaleString(getLocale() === "ru" ? "ru-RU" : "en-GB")} ${row.currency}` })
      ]));
    }

    if (parsed.rows.length > 200) {
      list.append(el("p", { class: "panel-note", text: ru()
        ? `Показаны первые 200 из ${parsed.rows.length}. Импортируются все отмеченные.`
        : `Showing the first 200 of ${parsed.rows.length}. All ticked rows are imported.` }));
    }
  }

  async function save() {
    const chosen = (parsed?.rows || []).filter((row) => row.include);
    if (!chosen.length) { toast(ru() ? "Нечего импортировать" : "Nothing to import", { tone: "warn" }); return; }

    const created = chosen.map((row) => ({
      ...records.blankRecord(row.type),
      name: row.name,
      category: row.category,
      amountMinor: row.amountMinor,
      currency: row.currency,
      date: row.date,
      source: ru() ? "выписка банка" : "bank statement"
      /* status stays the type's cautious default: this came from a file. */
    }));

    const result = await records.saveMany(created);
    if (!result.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }

    dialog.close();
    toast(ru()
      ? `Импортировано: ${countOf(created.length, PLURALS.record)}. Подтвердите их, чтобы вошли в расчёты.`
      : `Imported ${created.length} records. Confirm them to include them in the totals.`,
      { tone: "success", duration: 6000 });
    onDone?.();
  }
}
