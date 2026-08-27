/* Lab results.

   A number from a laboratory is meaningless without its unit and the range the
   laboratory itself printed next to it: 22 is excellent for one analyte and
   alarming for another. So a lab record keeps value, unit, refLow and refHigh
   together, and every judgement about "out of range" is made against the lab's
   own numbers — never against anything Nik'Os invented.

   Parsing runs entirely in the browser. The text of a medical report is never
   uploaded, which is the whole reason this is a paste box and not a service. */

import { el, openDialog, toast, confirmDialog } from "./ui.js?v=20260827-064144";
import { t, getLocale, formatDate, categoryLabel } from "./i18n.js?v=20260827-064144";
import { categoriesOf } from "./schema.js?v=20260827-064144";
import { parseLabText, guessDate, guessLab, rangeVerdict, labPanels, analyteHistory } from "./labs-parse.js?v=20260827-064144";
import * as store from "./store.js?v=20260827-064144";
import * as records from "./records.js?v=20260827-064144";

const ru = () => getLocale() === "ru";

/* ---------- Paste dialog ---------- */

export function openLabPaste({ onDone = null } = {}) {
  let rows = [];
  let date = records.today();
  let lab = "";

  const input = el("textarea", {
    class: "form-control lab-paste", rows: "8", "data-autofocus": "true",
    placeholder: ru()
      ? "Гемоглобин            148     г/л        130 - 160\nГлюкоза                5,4     ммоль/л    4,1 - 5,9\nВитамин D (25-OH)     22,5     нг/мл      30 - 100"
      : "Haemoglobin   148   g/l     130 - 160\nGlucose        5.4   mmol/l  4.1 - 5.9",
    oninput: () => analyse()
  });

  const summary = el("p", { class: "csv-summary" });
  const list = el("div", { class: "lab-rows" });
  const meta = el("div", { class: "form-inline" });

  const dialog = openDialog({
    title: t("health.pasteLab"),
    subtitle: t("health.pasteLabHint"),
    size: "form",
    body: el("div", { class: "lab-paste-body" }, [input, meta, summary, list]),
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: save })
    ])
  });

  renderMeta();
  analyse();
  return dialog;

  function renderMeta() {
    meta.replaceChildren(
      el("label", { class: "form-field" }, [
        el("span", { class: "form-label", text: t("health.labDate") }),
        el("input", { class: "form-control", type: "date", value: date,
                      oninput: (event) => { date = event.target.value || records.today(); } })
      ]),
      el("label", { class: "form-field" }, [
        el("span", { class: "form-label", text: t("form.lab") }),
        el("input", { class: "form-control", type: "text", value: lab, placeholder: "Инвитро",
                      oninput: (event) => { lab = event.target.value; } })
      ])
    );
  }

  function analyse() {
    const text = input.value;
    rows = parseLabText(text);

    if (text.trim()) {
      const foundDate = guessDate(text);
      const foundLab = guessLab(text);
      if (foundDate !== date || foundLab !== lab) {
        date = foundDate;
        if (foundLab) lab = foundLab;
        renderMeta();
      }
    }

    summary.textContent = rows.length
      ? `${t("health.labParsed")}: ${rows.length}`
      : (text.trim() ? t("health.labNothing") : "");
    summary.className = rows.length ? "csv-summary" : "csv-summary warn";

    renderRows();
  }

  function renderRows() {
    list.replaceChildren(...rows.map((row, index) => {
      const verdict = rangeVerdict(row);
      return el("div", { class: `lab-row${row.include ? "" : " excluded"}` }, [
        el("input", {
          type: "checkbox", checked: row.include ? "checked" : null,
          "aria-label": row.name,
          onchange: (event) => { rows[index].include = event.target.checked; renderRows(); }
        }),
        el("input", {
          class: "form-control compact lab-name", type: "text", value: row.name,
          oninput: (event) => { rows[index].name = event.target.value; }
        }),
        el("span", { class: `lab-value${verdict && verdict !== "in" ? " off" : ""}` },
          [`${row.value}${row.unit ? ` ${row.unit}` : ""}`]),
        el("span", { class: "lab-ref", text: row.refLow !== null || row.refHigh !== null
          ? `${row.refLow ?? "—"} – ${row.refHigh ?? "—"}` : "—" }),
        verdict && verdict !== "in"
          ? el("span", { class: `lab-flag ${verdict}`, text: verdict === "above" ? "↑" : "↓", title: verdictLabel(verdict) })
          : el("span", { class: "lab-flag" }),
        el("select", {
          class: "form-control compact",
          onchange: (event) => { rows[index].category = event.target.value; }
        }, categoriesOf("lab").map((item) => el("option", {
          value: item.key, selected: item.key === row.category ? "selected" : null,
          text: categoryLabel("lab", item.key)
        })))
      ]);
    }));
  }

  async function save() {
    const chosen = rows.filter((row) => row.include && String(row.name).trim());
    if (!chosen.length) { toast(t("health.labNothing"), { tone: "warn" }); return; }

    const created = chosen.map((row) => ({
      ...records.blankRecord("lab"),
      name: String(row.name).trim(),
      category: row.category,
      value: row.value,
      unit: row.unit,
      refLow: row.refLow,
      refHigh: row.refHigh,
      date,
      counterparty: lab,
      source: lab || (ru() ? "вставлено из PDF" : "pasted from a PDF"),
      status: "confirmed"
    }));

    const result = await store.commit((existing) => existing.concat(created), "lab-imported");
    if (!result.ok) {
      await confirmDialog({ title: t("sec.storageFull"), message: t("sec.storageFullHint"),
                            confirmLabel: t("app.close"), tone: "danger" });
      return;
    }
    store.pushAudit({ action: "imported", name: `${lab || "лаборатория"} · ${created.length}` });
    dialog.close();
    toast(ru() ? `Сохранено показателей: ${created.length}` : `${created.length} results saved`, { tone: "success" });
    onDone?.();
  }
}

/* ---------- Re-exports so views import one module ---------- */
export { parseLabText, guessDate, guessLab, rangeVerdict, labPanels, analyteHistory };

export const verdictLabel = (verdict) =>
  verdict === "above" ? t("health.aboveRange")
  : verdict === "below" ? t("health.belowRange")
  : verdict === "in" ? t("health.inRange") : "";



