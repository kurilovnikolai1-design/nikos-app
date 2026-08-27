/* The record form.

   Two changes matter most. First, only the fields that earn their place are
   shown up front — adding groceries used to mean scrolling a form more than
   two screens tall on a phone. Everything else lives behind "Больше полей".
   Second, the form is built from the schema, so a field can never belong to
   the wrong entity and a category list can never drift from its type. */

import { el, openDialog, toast, confirmDialog } from "./ui.js?v=20260827-083244";
import { t, getLocale, statusLabel, priorityLabel, confidenceLabel, ownerLabel, frequencyLabel, categoryLabel, typeLabel } from "./i18n.js?v=20260827-083244";
import { TYPES, typeDef, categoriesOf, statusesOf, fieldsOf, PRIORITY, CONFIDENCE, OWNER, FREQUENCY } from "./schema.js?v=20260827-083244";
import { CURRENCY_CODES, CURRENCIES, parseAmount, toMajor } from "./money.js?v=20260827-083244";
import { COINS } from "./rates.js?v=20260827-083244";
import * as store from "./store.js?v=20260827-083244";
import * as records from "./records.js?v=20260827-083244";

/* Fields worth showing before the owner asks for more. Everything not listed
   here is real, supported and one click away — just not in the way. */
const ESSENTIAL = new Set(["name", "category", "amount", "currency", "date", "counterparty", "coin", "quantity",
  "value", "unit", "refLow", "refHigh", "duration", "distance", "status", "dueTime", "dueDate", "details"]);

const PLACEHOLDER = {
  name: { task: ["Например: позвонить подрядчику", "e.g. Call the contractor"],
          expense: ["Например: продукты", "e.g. Groceries"],
          income: ["Например: зарплата", "e.g. Salary"],
          account: ["Например: основной счёт", "e.g. Main account"],
          payable: ["Например: ипотека", "e.g. Mortgage"],
          receivable: ["Например: займ другу", "e.g. Loan to a friend"],
          asset: ["Например: квартира на Ленина", "e.g. Apartment on Lenina"],
          investment: ["Например: доля в стройке", "e.g. Construction stake"],
          workout: ["Например: зал, ноги", "e.g. Gym, legs"],
          health: ["Например: годовой чекап", "e.g. Annual check-up"],
          document: ["Например: выписка ЕГРН.pdf", "e.g. Title deed.pdf"],
          person: ["Например: Игорь, подрядчик", "e.g. Igor, contractor"],
          lab: ["Например: Гемоглобин", "e.g. Haemoglobin"],
          decision: ["Например: продавать ли участок", "e.g. Sell the land or keep it"],
          default: ["Название записи", "Record name"] },
  counterparty: ["Например: Т-Банк, Игорь, Jetlend", "e.g. T-Bank, Igor, Jetlend"],
  source: ["Например: выписка банка, договор", "e.g. bank statement, contract"],
  terms: ["Например: 6%, платёж 17 числа", "e.g. 6%, payment on the 17th"],
  walletAddress: ["Публичный адрес (не приватный ключ)", "Public address (never a private key)"],
  details: ["Контекст, который пригодится позже", "Context that will help later"]
};

const pick = (pair) => (getLocale() === "ru" ? pair[0] : pair[1]);

function field(labelText, control, { hint = "", error = "", wide = false } = {}) {
  return el("label", { class: `form-field ${wide ? "wide" : ""} ${error ? "has-error" : ""}`.trim() }, [
    el("span", { class: "form-label", text: labelText }),
    control,
    hint ? el("small", { class: "form-hint", text: hint }) : null,
    error ? el("small", { class: "form-error", text: error }) : null
  ]);
}

const option = (value, label, selected) => el("option", { value, selected: selected ? "selected" : null, text: label });

function selectFrom(map, value, labeller, onChange) {
  const node = el("select", { class: "form-control", onchange: (event) => onChange(event.target.value) },
    Object.keys(map).map((key) => option(key, labeller(key), key === value)));
  return node;
}

export function openRecordForm(type, existing = null, { onSaved = null, presets = null } = {}) {
  const def = typeDef(type);
  if (!def) return null;

  const draft = existing
    ? { ...records.blankRecord(type), ...existing }
    : { ...records.blankRecord(type), ...(presets || {}) };

  let showAdvanced = Boolean(existing);
  let errors = {};
  let unsafe = [];

  const bodyHost = el("div", { class: "record-form" });
  const set = (key, value) => { draft[key] = value; };

  const dialog = openDialog({
    title: existing ? t("form.editTitle") : `${t("app.add")}: ${typeLabel(type).toLowerCase()}`,
    subtitle: existing ? "" : subtitleFor(type),
    size: "form",
    body: bodyHost,
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: submit })
    ])
  });

  render();
  return dialog;

  function render() {
    const visible = fieldsOf(type).filter((name) => showAdvanced || ESSENTIAL.has(name));
    const hiddenCount = fieldsOf(type).length - visible.length;

    const nodes = visible.map((name) => buildField(name)).filter(Boolean);

    if (hiddenCount > 0 || showAdvanced) {
      nodes.push(el("button", {
        class: "text-button form-toggle", type: "button",
        text: showAdvanced ? `${t("form.fewerFields")} ↑` : `${t("form.moreFields")} (${hiddenCount}) ↓`,
        onclick: () => { showAdvanced = !showAdvanced; render(); }
      }));
    }

    if (unsafe.length) {
      nodes.unshift(el("div", { class: "form-danger", role: "alert" }, [
        el("strong", { text: getLocale() === "ru" ? unsafe[0].ru : unsafe[0].en }),
        el("p", { text: t("sec.seedBlockedHint") })
      ]));
    }

    bodyHost.replaceChildren(...nodes);
    if (!existing) bodyHost.querySelector("input, select, textarea")?.setAttribute("data-autofocus", "true");
  }

  function buildField(name) {
    const error = errors[name] ? t(errors[name]) : "";

    switch (name) {
      case "name": {
        const placeholder = pick(PLACEHOLDER.name[type] || PLACEHOLDER.name.default);
        return field(t("form.name"), el("input", {
          class: "form-control", type: "text", value: draft.name || "", placeholder, maxlength: "200",
          oninput: (event) => set("name", event.target.value)
        }), { error, wide: true });
      }

      case "category":
        return field(t("form.category"), el("select", {
          class: "form-control", onchange: (event) => { set("category", event.target.value); if (type === "measurement") render(); }
        }, categoriesOf(type).map((item) => option(item.key, categoryLabel(type, item.key), item.key === draft.category))), { error });

      case "counterparty":
        return field(type === "lab" ? t("form.lab") : t("form.counterparty"), el("input", {
          class: "form-control", type: "text", value: draft.counterparty || "", placeholder: pick(PLACEHOLDER.counterparty),
          oninput: (event) => set("counterparty", event.target.value)
        }), { error });

      case "contact":
        return field(t("form.contact"), el("input", {
          class: "form-control", type: "text", value: draft.contact || "",
          oninput: (event) => set("contact", event.target.value)
        }), { error });

      case "amount":
        return amountField("amountMinor", def.amountLabel ? pick([def.amountLabel.ru, def.amountLabel.en]) : t("form.amount"), error);

      case "costBasis":
        return amountField("costBasisMinor", t("form.costBasis"), "");

      case "currency":
        return field(t("form.currency"), el("select", {
          class: "form-control", onchange: (event) => set("currency", event.target.value)
        }, CURRENCY_CODES.map((code) =>
          option(code, `${code} ${CURRENCIES[code].symbol}`, code === (draft.currency || "RUB")))), {});

      case "coin":
        return field(t("form.coin"), el("input", {
          class: "form-control", type: "text", list: "nikos-coins", value: draft.coin || "",
          placeholder: "BTC", oninput: (event) => set("coin", event.target.value.toUpperCase())
        }), { hint: getLocale() === "ru" ? "Цена подтянется автоматически для известных монет" : "Price is fetched automatically for known coins" });

      case "quantity":
        return field(t("form.quantity"), el("input", {
          class: "form-control", type: "text", inputmode: "decimal", value: draft.quantity ?? "",
          oninput: (event) => set("quantity", event.target.value.replace(",", ".").trim() || null)
        }), { error });

      case "walletAddress":
        return field(t("form.walletAddress"), el("input", {
          class: "form-control", type: "text", value: draft.walletAddress || "", placeholder: pick(PLACEHOLDER.walletAddress),
          oninput: (event) => set("walletAddress", event.target.value.trim())
        }), { error, wide: true });

      case "value":
        return field(type === "lab" ? t("form.value") : measurementLabel(), el("input", {
          class: "form-control", type: "text", inputmode: "decimal", value: draft.value ?? "",
          oninput: (event) => set("value", event.target.value.replace(",", ".").trim() || null)
        }), { error });

      case "unit":
        return field(t("form.unit"), el("input", {
          class: "form-control", type: "text", value: draft.unit || "", placeholder: "ммоль/л",
          oninput: (event) => set("unit", event.target.value.trim())
        }), {});

      case "refLow":
        return field(t("form.refLow"), el("input", {
          class: "form-control", type: "text", inputmode: "decimal", value: draft.refLow ?? "",
          oninput: (event) => set("refLow", event.target.value === "" ? null : Number(event.target.value.replace(",", ".")))
        }), { hint: getLocale() === "ru" ? "Как указано в бланке" : "As printed on the report" });

      case "refHigh":
        return field(t("form.refHigh"), el("input", {
          class: "form-control", type: "text", inputmode: "decimal", value: draft.refHigh ?? "",
          oninput: (event) => set("refHigh", event.target.value === "" ? null : Number(event.target.value.replace(",", ".")))
        }), {});

      case "duration":
        return field(t("form.duration"), numberInput("duration", { min: 0, max: 1440 }), { error });

      case "distance":
        return field(t("form.distance"), numberInput("distance", { min: 0, step: 0.1 }), {});

      case "intensity":
        return field(t("form.intensity"), numberInput("intensity", { min: 1, max: 10 }), {});

      case "feeling":
        return field(t("form.feeling"), numberInput("feeling", { min: 1, max: 5 }), {});

      case "progress":
        return field(t("form.progress"), numberInput("progress", { min: 0, max: 100 }), {});

      case "ownershipPercent":
        return field(t("form.ownershipPercent"), numberInput("ownershipPercent", { min: 0, max: 100 }), {
          hint: getLocale() === "ru" ? "Если владеете не полностью — в капитал войдёт только ваша доля" : "Part ownership counts only your share",
          error
        });

      case "rate":
        return field(t("form.rate"), numberInput("rate", { min: 0, max: 200, step: 0.01 }), {});

      case "date":
        return dateField("date", t("form.date"), error);
      case "dueDate":
        return dateField("dueDate", t("form.dueDate"), "");
      case "endDate":
        return dateField("endDate", t("form.endDate"), "");
      case "expiresAt":
        return dateField("expiresAt", t("form.expiresAt"), "");
      case "reminderDate":
        return dateField("reminderDate", t("form.reminderDate"), "");

      case "dueTime":
        return field(t("form.dueTime"), el("input", {
          class: "form-control", type: "time", value: draft.dueTime || "",
          oninput: (event) => set("dueTime", event.target.value)
        }), {});

      case "status":
        return field(t("form.status"), el("select", {
          class: "form-control", onchange: (event) => set("status", event.target.value)
        }, statusesOf(type).map((key) => option(key, statusLabel(key), key === draft.status))), {
          hint: statusHint()
        });

      case "priority":
        return field(t("form.priority"), selectFrom(PRIORITY, draft.priority, priorityLabel, (value) => set("priority", value)), {});

      case "owner":
        return field(t("form.owner"), selectFrom(OWNER, draft.owner, ownerLabel, (value) => set("owner", value)), {});

      case "confidence":
        return field(t("form.confidence"), selectFrom(CONFIDENCE, draft.confidence, confidenceLabel, (value) => set("confidence", value)), {});

      case "terms":
        return field(t("form.terms"), el("input", {
          class: "form-control", type: "text", value: draft.terms || "", placeholder: pick(PLACEHOLDER.terms),
          oninput: (event) => set("terms", event.target.value)
        }), {});

      case "source":
        return field(t("form.source"), el("input", {
          class: "form-control", type: "text", value: draft.source || "", placeholder: pick(PLACEHOLDER.source),
          oninput: (event) => set("source", event.target.value)
        }), {});

      case "linked":
        return linkedField();

      case "recurrence":
        return recurrenceField();

      case "file":
        return fileField();

      case "reasoning":
        return field(t("form.reasoning"), el("textarea", {
          class: "form-control", rows: "3", value: draft.reasoning || "",
          oninput: (event) => set("reasoning", event.target.value)
        }), { wide: true });

      case "details":
        return field(t("form.details"), el("textarea", {
          class: "form-control", rows: "3", placeholder: pick(PLACEHOLDER.details),
          oninput: (event) => set("details", event.target.value)
        }, [draft.details || ""]), { wide: true });

      default:
        return null;
    }
  }

  function numberInput(key, { min, max, step = 1 } = {}) {
    return el("input", {
      class: "form-control", type: "number", inputmode: "decimal",
      min: min ?? null, max: max ?? null, step,
      value: draft[key] ?? "",
      oninput: (event) => set(key, event.target.value === "" ? null : Number(event.target.value))
    });
  }

  function dateField(key, labelText, error) {
    return field(labelText, el("input", {
      class: "form-control", type: "date", value: draft[key] || "",
      oninput: (event) => set(key, event.target.value || null)
    }), { error });
  }

  /* Amounts accept "1 500", "1,5к" and "2м" and are stored as integer minor
     units, so no total ever drifts by a rounding error. */
  function amountField(key, labelText, error) {
    const initial = draft[key] === null || draft[key] === undefined
      ? "" : String(toMajor(draft[key], draft.currency || "RUB"));
    const preview = el("small", { class: "form-hint", text: t("form.amountHint") });

    const input = el("input", {
      class: "form-control", type: "text", inputmode: "decimal", value: initial,
      placeholder: def.requires?.includes("amount") ? "" : t("form.optional"),
      oninput: (event) => {
        const parsed = parseAmount(event.target.value, draft.currency || "RUB");
        set(key, parsed);
        preview.textContent = event.target.value.trim() && parsed === null
          ? (getLocale() === "ru" ? "Не похоже на число" : "That is not a number")
          : t("form.amountHint");
      }
    });

    return el("label", { class: `form-field ${errors[key] || error ? "has-error" : ""}`.trim() }, [
      el("span", { class: "form-label", text: labelText }),
      input, preview,
      error ? el("small", { class: "form-error", text: error }) : null
    ]);
  }

  function measurementLabel() {
    const units = { weight: "кг", bodyfat: "%", sleep: "ч", hrv: "мс", rhr: "уд/мин", recovery: "%", strain: "", steps: "", pressure: "мм рт. ст." };
    const unit = units[draft.category];
    return unit ? `${t("form.value")}, ${unit}` : t("form.value");
  }

  function statusHint() {
    const verified = ["confirmed", "active", "paid", "done"].includes(draft.status);
    if (TYPES[type].role === "none") return "";
    return verified
      ? (getLocale() === "ru" ? "Войдёт в расчёты" : "Counted in totals")
      : (getLocale() === "ru" ? "Пока не попадёт в суммы" : "Not counted in totals yet");
  }

  function linkedField() {
    const candidates = store.liveRecords()
      .filter((item) => item.id !== draft.id && item.type !== "snapshot")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 200);
    const selected = new Set(draft.linkedIds || []);

    const select = el("select", {
      class: "form-control",
      onchange: (event) => {
        const id = event.target.value;
        if (id) { selected.add(id); set("linkedIds", [...selected]); render(); }
      }
    }, [option("", t("form.noLink"), false),
        ...candidates.filter((item) => !selected.has(item.id))
          .map((item) => option(item.id, `${typeLabel(item.type)}: ${item.name}`, false))]);

    const chips = [...selected].map((id) => {
      const item = store.byId(id);
      if (!item) return null;
      return el("button", {
        class: "link-chip", type: "button", text: `${item.name} ✕`,
        onclick: () => { selected.delete(id); set("linkedIds", [...selected]); render(); }
      });
    }).filter(Boolean);

    return el("div", { class: "form-field wide" }, [
      el("span", { class: "form-label", text: t("form.linked") }),
      select,
      chips.length ? el("div", { class: "link-chips" }, chips) : null
    ]);
  }

  function recurrenceField() {
    const toggle = el("label", { class: "switch-row" }, [
      el("input", {
        type: "checkbox", checked: draft.recurring ? "checked" : null,
        onchange: (event) => { set("recurring", event.target.checked); render(); }
      }),
      el("span", { text: t("form.recurrence") })
    ]);

    if (!draft.recurring) return el("div", { class: "form-field wide" }, [toggle]);

    return el("div", { class: "form-field wide" }, [
      toggle,
      el("div", { class: "form-inline" }, [
        field(t("form.frequency"), selectFrom(FREQUENCY, draft.frequency, frequencyLabel, (value) => set("frequency", value))),
        field(t("form.nextDue"), el("input", {
          class: "form-control", type: "date", value: draft.nextDueDate || draft.date || "",
          oninput: (event) => set("nextDueDate", event.target.value || null)
        }))
      ]),
      el("small", { class: "form-hint", text: getLocale() === "ru"
        ? "Это план обязательства. Фактические платежи добавляйте отдельными расходами."
        : "This is the obligation template. Log actual payments as separate expenses." })
    ]);
  }

  /* Only the file's name, size and type are kept — the file itself is never
     read into storage or sent anywhere. */
  function fileField() {
    const current = draft.attachment
      ? el("small", { class: "form-hint", text: `${draft.attachment.name} · ${Math.round(draft.attachment.size / 1024)} KB` })
      : null;
    return el("label", { class: "form-field wide" }, [
      el("span", { class: "form-label", text: t("form.file") }),
      el("input", {
        class: "form-control", type: "file",
        accept: ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv",
        onchange: (event) => {
          const file = event.target.files?.[0];
          set("attachment", file ? { name: file.name, size: file.size, mime: file.type } : null);
          render();
        }
      }),
      current
    ]);
  }

  async function submit() {
    errors = {};
    unsafe = [];

    const validation = records.validate(draft);
    if (validation.unsafe.length) {
      unsafe = validation.unsafe;
      showAdvanced = true;
      render();
      toast(t("sec.seedBlocked"), { tone: "danger" });
      return;
    }
    if (validation.errors.length) {
      for (const problem of validation.errors) errors[problem.field === "amount" ? "amountMinor" : problem.field] = problem.key;
      if (validation.errors.some((problem) => !ESSENTIAL.has(problem.field))) showAdvanced = true;
      render();
      return;
    }

    const saved = await records.saveRecord(draft);

    if (!saved.ok && saved.reason === "quota") {
      await confirmDialog({
        title: t("sec.storageFull"), message: t("sec.storageFullHint"),
        confirmLabel: t("app.close"), tone: "danger"
      });
      return;
    }
    if (!saved.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }

    dialog.close();
    toast(existing ? t("rec.updated") : t("rec.saved"), { tone: "success" });
    onSaved?.(saved.record);
  }
}

function subtitleFor(type) {
  const hints = {
    expense: ["Фактическая трата. Для регулярного обязательства включите повторение.", "An actual spend. Turn on repeat for a standing obligation."],
    income: ["Фактическое поступление с датой и источником.", "Actual money received, with a date and a source."],
    payable: ["Деньги, которые должны вы.", "Money you owe."],
    receivable: ["Деньги, которые должны вам.", "Money owed to you."],
    investment: ["Владение фиксируется явно: обсуждаемое — не значит ваше.", "Ownership is explicit: discussed is not owned."],
    crypto: ["Только наблюдение. Ключи и seed-фразы Nik'Os не принимает.", "Observation only. Nik'Os never accepts keys or seed phrases."],
    workout: ["Что сделали, сколько и как себя чувствовали.", "What you did, how much, and how it felt."],
    measurement: ["Один показатель за одну дату.", "One measurement for one date."],
    health: ["Контекст, а не диагноз.", "Context, not diagnosis."],
    document: ["Сохраняются только имя и размер файла — сам файл никуда не уходит.", "Only the file name and size are stored — the file never leaves your device."],
    lab: ["Значение без единицы и нормы ничего не значит — впишите их из бланка.", "A value means nothing without its unit and range — copy them from the report."]
  };
  return hints[type] ? pick(hints[type]) : "";
}

/* Datalist of known coins, appended once. */
export function ensureCoinList() {
  if (document.getElementById("nikos-coins")) return;
  document.body.append(el("datalist", { id: "nikos-coins" },
    Object.keys(COINS).map((symbol) => el("option", { value: symbol }))));
}
