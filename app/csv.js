/* CSV import for scale and wearable exports.

   Rows land as measurements with a real numeric value and a real date, so they
   feed the weight and sleep trends instead of becoming unreadable text blobs.
   Everything imported stays unconfirmed until the owner accepts it. */

import { el, openDialog, toast } from "./ui.js?v=20260827-055819";
import { t, getLocale, countOf, PLURALS, categoryLabel } from "./i18n.js?v=20260827-055819";
import { categoriesOf } from "./schema.js?v=20260827-055819";
import * as store from "./store.js?v=20260827-055819";
import * as records from "./records.js?v=20260827-055819";

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
