/* Lab results.

   A number from a laboratory is meaningless without its unit and the range the
   laboratory itself printed next to it: 22 is excellent for one analyte and
   alarming for another. So a lab record keeps value, unit, refLow and refHigh
   together, and every judgement about "out of range" is made against the lab's
   own numbers — never against anything Nik'Os invented.

   Parsing runs entirely in the browser. The text of a medical report is never
   uploaded, which is the whole reason this is a paste box and not a service. */

import { el, openDialog, toast, confirmDialog } from "./ui.js?v=20260827-171138";
import { t, getLocale, formatDate, categoryLabel } from "./i18n.js?v=20260827-171138";
import { categoriesOf } from "./schema.js?v=20260827-171138";
import { parseLabText, guessDate, guessLab, rangeVerdict, labPanels, analyteHistory, byAnalyte, currentlyOutOfRange } from "./labs-parse.js?v=20260827-171138";
import * as store from "./store.js?v=20260827-171138";
import * as records from "./records.js?v=20260827-171138";
import { parseReport, toRecord, PROCEDURE_NOTE } from "./procedures.js?v=20260827-171138";
import { openRecordForm } from "./form.js?v=20260827-171138";

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
export { parseLabText, guessDate, guessLab, rangeVerdict, labPanels, analyteHistory, byAnalyte, currentlyOutOfRange };

export const verdictLabel = (verdict) =>
  verdict === "above" ? t("health.aboveRange")
  : verdict === "below" ? t("health.belowRange")
  : verdict === "in" ? t("health.inRange") : "";




/* ---------- Procedure reports ---------- */

/* A colonoscopy or gastroscopy report is prose, not a table, so it gets its
   own box. The dialog shows exactly what was recognised and what was not —
   an extraction the owner cannot check is worse than no extraction. */
export function openProcedurePaste({ onDone = null } = {}) {
  let parsed = null;

  const input = el("textarea", {
    class: "form-control lab-paste", rows: "9", "data-autofocus": "true",
    placeholder: ru()
      ? "Вставьте текст выписки целиком — из PDF, из личного кабинета, из письма.\n\nДата исследования: 14.05.2026\nВидеоколоноскопия\n…\nЗаключение: …\nРекомендации: контрольная колоноскопия через 3 года."
      : "Paste the whole report — from a PDF, a portal, an email.",
    oninput: () => analyse()
  });

  const summary = el("div", { class: "procedure-summary" });

  const dialog = openDialog({
    title: ru() ? "Вставить выписку" : "Paste a report",
    subtitle: ru() ? "Колоноскопия, ЭГДС, УЗИ, МРТ" : "Colonoscopy, gastroscopy, ultrasound, MRI",
    size: "form",
    body: el("div", { class: "lab-paste-body" }, [
      input,
      summary,
      el("p", { class: "panel-note", text: ru() ? PROCEDURE_NOTE.ru : PROCEDURE_NOTE.en })
    ]),
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button",
                     text: ru() ? "Разобрать и открыть" : "Parse and open", onclick: proceed })
    ])
  });

  analyse();
  return dialog;

  function analyse() {
    parsed = parseReport(input.value, getLocale());
    summary.textContent = "";
    if (!parsed) return;

    const line = (label, value, ok) => el("div", { class: `procedure-line${ok ? "" : " missing"}` }, [
      el("span", { class: "procedure-label", text: label }),
      el("span", { class: "procedure-value", text: value })
    ]);

    const unknown = ru() ? "не нашёл — впишете сами" : "not found — fill it in";

    summary.append(
      line(ru() ? "Исследование" : "Examination", parsed.kind || unknown, Boolean(parsed.kind)),
      line(ru() ? "Дата" : "Date",
           parsed.date ? formatDate(parsed.date, "long") : unknown, Boolean(parsed.date)),
      line(ru() ? "Заключение" : "Conclusion", parsed.conclusion || unknown, Boolean(parsed.conclusion))
    );

    if (parsed.followUp) {
      summary.append(el("div", { class: "procedure-line" }, [
        el("span", { class: "procedure-label", text: ru() ? "Контроль" : "Follow-up" }),
        el("span", { class: "procedure-value" }, [
          el("b", { text: formatDate(parsed.followUp.date, "long") }),
          el("em", { text: `«${parsed.followUp.quote}»` })
        ])
      ]));
    }
  }

  /* Opens the ordinary record form, prefilled. Nothing is saved behind the
     owner's back: he sees every field the report produced before it lands. */
  function proceed() {
    if (!parsed) { toast(ru() ? "Вставьте текст выписки" : "Paste the report first", { tone: "warn" }); return; }
    const draft = toRecord(parsed, getLocale());
    dialog.close();
    openRecordForm("health", null, { presets: draft, onSaved: () => onDone?.() });
  }
}
