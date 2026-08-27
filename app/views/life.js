/* Assets, Health & sport, Documents, People, Decisions, Timeline. */

import { el, panel, panelHeader, metricCard, emptyState, toast } from "../ui.js";
import { t, getLocale, formatDate, relativeDays, countOf, plural, PLURALS, categoryLabel,
         statusLabel, formatNumber, typeLabel } from "../i18n.js";
import { formatMoney } from "../money.js";
import { netWorth, periodRange, sportSummary } from "../finance.js";
import { categoriesOf } from "../schema.js";
import { recordList, recordRow, addButton, pageHeading, refresh, chipRow, sparkline } from "../render.js";
import { openRecordForm } from "../form.js";
import { importCsv } from "../csv.js";
import * as store from "../store.js";
import * as records from "../records.js";

const ru = () => getLocale() === "ru";
const base = () => store.getSettings().baseCurrency || "RUB";
const money = (minor) => formatMoney(minor, base(), getLocale());

/* ---------- Assets ---------- */

const assetState = { category: "all" };

export function assetsView() {
  const all = store.recordsOfType("asset");
  const worth = netWorth(store.liveRecords(), base(), store.getRates());
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.assets"),
    ru() ? "Дома, земля, машины и доли — с оценкой и долей владения." : "Homes, land, cars and stakes — with valuation and ownership share.",
    addButton("asset", typeLabel("asset"), refresh)));

  const groups = new Map();
  for (const record of all) groups.set(record.category, (groups.get(record.category) || 0) + 1);

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: t("money.property"), value: money(worth.buckets.property),
                 note: ru() ? "только подтверждённое" : "confirmed only" }),
    metricCard({ kicker: ru() ? "ОБЪЕКТОВ" : "ITEMS", value: String(all.length) }),
    metricCard({ kicker: ru() ? "С ОЦЕНКОЙ" : "VALUED",
                 value: String(all.filter((record) => record.amountMinor !== null).length),
                 note: all.filter((record) => record.amountMinor === null).length
                   ? `${all.filter((record) => record.amountMinor === null).length} ${ru() ? "без оценки" : "unvalued"}` : "" })
  ]));

  page.append(chipRow([
    { value: "all", label: t("app.all"), count: all.length },
    ...categoriesOf("asset").filter((item) => groups.has(item.key))
      .map((item) => ({ value: item.key, label: categoryLabel("asset", item.key), count: groups.get(item.key) }))
  ], assetState.category, (value) => { assetState.category = value; refresh(); }));

  const shown = assetState.category === "all" ? all : all.filter((record) => record.category === assetState.category);

  page.append(panel("records-panel",
    panelHeader(ru() ? "ИМУЩЕСТВО" : "ASSETS", ru() ? "Ваши объекты" : "Your holdings"),
    recordList(`assets-${assetState.category}`, shown, {
      empty: ru() ? "Добавьте квартиру, дом, землю, автомобиль или долю в бизнесе." : "Add an apartment, house, land, car or business stake.",
      addType: "asset"
    })));

  return page;
}

/* ---------- Health & sport ---------- */

const healthState = { tab: "sport", period: "month" };

export function healthView() {
  const all = store.liveRecords();
  const range = healthState.period === "all" ? null : periodRange(healthState.period, 0);
  const sport = sportSummary(all, range);
  const workouts = store.recordsOfType("workout");
  const measurements = store.recordsOfType("measurement");
  const healthRecords = store.recordsOfType("health");

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.health"),
    t("health.contextNotDiagnosis"),
    [el("button", { class: "ghost-button", type: "button", text: `＋ ${t("health.logMeasurement")}`,
                    onclick: () => openRecordForm("measurement", null, { onSaved: refresh }) }),
     addButton("workout", t("health.logWorkout"), refresh)]));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: t("health.workouts"), value: String(sport.count),
                 note: healthState.period === "month" ? t("health.thisMonth").toLowerCase() : "" }),
    metricCard({ kicker: t("health.hours"), value: formatNumber(sport.hours, 1) }),
    metricCard({ kicker: t("health.distance"),
                 value: sport.distance ? `${formatNumber(sport.distance, 1)} ${ru() ? "км" : "km"}` : "—" }),
    metricCard({ kicker: t("health.weight"),
                 value: sport.weight.latest !== null ? `${formatNumber(sport.weight.latest, 1)} ${ru() ? "кг" : "kg"}` : "—",
                 note: sport.weight.change !== null
                   ? `${sport.weight.change > 0 ? "+" : ""}${formatNumber(sport.weight.change, 1)} ${ru() ? "за период" : "over the period"}` : "" }),
    metricCard({ kicker: t("health.streak"),
                 value: sport.streak ? `${sport.streak}` : "—",
                 note: sport.streak ? plural(sport.streak, PLURALS.day) : "" })
  ]));

  page.append(chipRow([
    { value: "week", label: t("app.week") },
    { value: "month", label: t("app.month") },
    { value: "year", label: t("app.year") },
    { value: "all", label: t("app.all") }
  ], healthState.period, (value) => { healthState.period = value; refresh(); }));

  /* Trends that only make sense as a line */
  const trends = [
    { key: "weight", series: sport.weight.series, label: t("health.weight"), unit: ru() ? "кг" : "kg", tone: "cyan" },
    { key: "sleep", series: sport.sleep, label: categoryLabel("measurement", "sleep"), unit: ru() ? "ч" : "h", tone: "violet" },
    { key: "rhr", series: sport.rhr, label: categoryLabel("measurement", "rhr"), unit: ru() ? "уд/мин" : "bpm", tone: "amber" }
  ].filter((trend) => trend.series.length > 1);

  if (trends.length) {
    page.append(panel("trend-panel",
      panelHeader(ru() ? "ДИНАМИКА" : "TRENDS", ru() ? "Как меняется" : "How it moves"),
      el("div", { class: "trend-grid" }, trends.map((trend) => el("div", { class: "trend-card" }, [
        el("span", { class: "panel-kicker", text: trend.label }),
        sparkline(trend.series.slice(-60), { tone: trend.tone }),
        el("div", { class: "trend-foot" }, [
          el("b", { text: `${formatNumber(trend.series.at(-1).value, 1)} ${trend.unit}` }),
          el("small", { text: formatDate(trend.series.at(-1).date, "short") })
        ])
      ])))));
  }

  page.append(el("div", { class: "segmented wide" }, [
    tab("sport", `${t("health.workouts")} (${workouts.length})`),
    tab("measurements", `${typePlural("measurement")} (${measurements.length})`),
    tab("records", `${typeLabel("health")} (${healthRecords.length})`)
  ]));

  if (healthState.tab === "sport") {
    page.append(panel("records-panel",
      panelHeader(ru() ? "ТРЕНИРОВКИ" : "WORKOUTS", sport.count ? countOf(sport.count, PLURALS.workout) : ""),
      recordList("health-workouts", sortByDate(workouts), {
        empty: ru() ? "Запишите первую тренировку — зал, бег, что угодно." : "Log your first workout.",
        addType: "workout"
      })));
  } else if (healthState.tab === "measurements") {
    page.append(panel("records-panel",
      panelHeader(ru() ? "ПОКАЗАТЕЛИ" : "MEASUREMENTS", "",
        el("button", { class: "small-button", type: "button", text: t("health.importCsv"),
                       onclick: () => importCsv({ onDone: refresh }) })),
      recordList("health-measurements", sortByDate(measurements), {
        empty: ru() ? "Добавьте вес, сон, пульс покоя — или импортируйте CSV из WHOOP либо весов." : "Add weight, sleep or resting heart rate — or import a CSV.",
        addType: "measurement"
      })));
  } else {
    page.append(panel("records-panel",
      panelHeader(ru() ? "ЗДОРОВЬЕ" : "HEALTH", ru() ? "Осмотры, лекарства, состояния" : "Check-ups, medication, conditions"),
      recordList("health-records", sortByDate(healthRecords), {
        empty: ru() ? "Добавьте осмотр, лекарство или состояние." : "Add a check-up, a medication or a condition.",
        addType: "health"
      })));
  }

  page.append(el("p", { class: "panel-note", text: ru()
    ? "Медицинские записи хранятся вместе с остальными и попадают под тот же PIN и то же шифрование. Nik'Os не ставит диагнозов."
    : "Health records sit under the same PIN and the same encryption as everything else. Nik'Os does not diagnose." }));

  return page;

  function tab(value, label) {
    return el("button", {
      class: `seg-button${healthState.tab === value ? " selected" : ""}`, type: "button", text: label,
      onclick: () => { healthState.tab = value; refresh(); }
    });
  }
}

const typePlural = (key) => (ru() ? { measurement: "Показатели" }[key] : { measurement: "Measurements" }[key]) || key;
const sortByDate = (list) => [...list].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

/* ---------- Documents ---------- */

export function documentsView() {
  const all = store.recordsOfType("document");
  const expiring = all.filter((record) => {
    if (!record.expiresAt) return false;
    const days = (new Date(`${record.expiresAt}T12:00:00`) - Date.now()) / 86_400_000;
    return days <= 90;
  });

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.documents"),
    ru() ? "Где что лежит и когда истекает. Сами файлы остаются у вас." : "Where things are and when they expire. The files themselves stay with you.",
    addButton("document", typeLabel("document"), refresh)));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "ДОКУМЕНТОВ" : "DOCUMENTS", value: String(all.length) }),
    metricCard({ kicker: ru() ? "ИСТЕКАЮТ" : "EXPIRING", value: String(expiring.length),
                 note: ru() ? "в ближайшие 90 дней" : "in the next 90 days",
                 tone: expiring.length ? "negative" : "" })
  ]));

  if (expiring.length) {
    page.append(panel("records-panel",
      panelHeader(ru() ? "ТРЕБУЮТ ВНИМАНИЯ" : "NEEDS ATTENTION", ru() ? "Скоро истекают" : "Expiring soon"),
      recordList("documents-expiring", expiring, { empty: "", compact: true })));
  }

  page.append(panel("records-panel",
    panelHeader(ru() ? "ХРАНИЛИЩЕ" : "VAULT", ru() ? "Все документы" : "All documents"),
    recordList("documents-all", sortByDate(all), {
      empty: ru() ? "Добавьте выписку, договор, страховку или паспорт техники." : "Add a statement, contract, insurance policy or title.",
      addType: "document"
    })));

  page.append(el("p", { class: "panel-note", text: ru()
    ? "Nik'Os сохраняет только имя, размер и тип файла. Сам файл никуда не загружается и не покидает устройство."
    : "Nik'Os stores only the file name, size and type. The file itself is never uploaded and never leaves your device." }));

  return page;
}

/* ---------- People ---------- */

export function peopleView() {
  const all = store.recordsOfType("person");
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.people"),
    ru() ? "Только тот контекст, который помогает делу двигаться." : "Only the context that helps things move.",
    addButton("person", typeLabel("person"), refresh)));

  const groups = categoriesOf("person")
    .map((category) => ({ category, items: all.filter((record) => record.category === category.key) }))
    .filter((group) => group.items.length);

  if (!all.length) {
    page.append(panel("records-panel",
      panelHeader(ru() ? "ЛЮДИ" : "PEOPLE", ""),
      recordList("people-all", [], {
        empty: ru() ? "Добавьте подрядчика, врача, партнёра или члена семьи." : "Add a contractor, doctor, partner or family member.",
        addType: "person"
      })));
    return page;
  }

  for (const group of groups) {
    page.append(panel("records-panel",
      panelHeader(categoryLabel("person", group.category.key).toUpperCase(), "",
        el("span", { class: "muted-text", text: countOf(group.items.length, PLURALS.record) })),
      recordList(`people-${group.category.key}`, group.items, { empty: "", compact: true })));
  }

  return page;
}

/* ---------- Decisions ---------- */

export function decisionsView() {
  const all = store.recordsOfType("decision");
  const open = all.filter((record) => ["draft", "active", "waiting"].includes(record.status));
  const closed = all.filter((record) => record.status === "closed");
  const dueReview = all.filter((record) => record.reminderDate && record.reminderDate <= records.today());

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.decisions"),
    ru() ? "Зафиксируйте ход мысли сейчас, чтобы через год понять, почему так решили." : "Capture the reasoning now, so a year from now you know why.",
    addButton("decision", typeLabel("decision"), refresh)));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "ОТКРЫТЫЕ" : "OPEN", value: String(open.length) }),
    metricCard({ kicker: ru() ? "НА ПЕРЕСМОТР" : "TO REVIEW", value: String(dueReview.length),
                 tone: dueReview.length ? "negative" : "" }),
    metricCard({ kicker: ru() ? "ЗАКРЫТЫЕ" : "CLOSED", value: String(closed.length) })
  ]));

  page.append(panel("records-panel",
    panelHeader(ru() ? "РЕШЕНИЯ" : "DECISIONS", ru() ? "В работе" : "Open"),
    recordList("decisions-open", open, {
      empty: ru() ? "Запишите первое решение — что выбираете и почему." : "Log your first decision: what you chose, and why.",
      addType: "decision"
    })));

  if (closed.length) {
    page.append(panel("records-panel",
      panelHeader(ru() ? "АРХИВ" : "ARCHIVE", ru() ? "Закрытые решения" : "Closed decisions"),
      recordList("decisions-closed", closed, { empty: "", compact: true })));
  }

  return page;
}

/* ---------- Timeline ---------- */

export function timelineView() {
  const events = store.recordsOfType("event");
  const audit = store.getAudit().slice(-40).reverse();
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.timeline"),
    ru() ? "Долгая история: что произошло и когда." : "The long view: what happened, and when.",
    addButton("event", typeLabel("event"), refresh)));

  const byYear = new Map();
  for (const event of [...events].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))) {
    const year = (event.date || "—").slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(event);
  }

  if (events.length) {
    page.append(panel("history-panel",
      panelHeader(ru() ? "СОБЫТИЯ" : "EVENTS", ru() ? "Нить вашей жизни" : "Your thread"),
      el("div", { class: "timeline" }, [...byYear.entries()].map(([year, items]) =>
        el("div", { class: "timeline-year" }, [
          el("div", { class: "timeline-year-label", text: year }),
          ...items.map((event) => el("button", {
            class: "timeline-entry", type: "button",
            dataset: { recordId: event.id },
            onclick: () => openRecordForm("event", event, { onSaved: refresh })
          }, [
            el("span", { class: "timeline-dot", "aria-hidden": "true" }),
            el("span", {}, [
              el("strong", { text: event.name }),
              el("small", { text: `${formatDate(event.date, "long")} · ${categoryLabel("event", event.category)}` }),
              event.details ? el("small", { class: "record-note", text: event.details }) : null
            ])
          ]))
        ])))));
  } else {
    page.append(panel("history-panel",
      panelHeader(ru() ? "СОБЫТИЯ" : "EVENTS", ru() ? "Таймлайн начинается здесь" : "The timeline starts here"),
      emptyState(ru() ? "Отметьте важное: покупку, переезд, запуск, решение." : "Mark what mattered: a purchase, a move, a launch, a decision.",
        typeLabel("event"), () => openRecordForm("event", null, { onSaved: refresh }))));
  }

  page.append(panel("history-panel",
    panelHeader(ru() ? "ЖУРНАЛ ИЗМЕНЕНИЙ" : "CHANGE LOG", ru() ? "Что менялось в Nik'Os" : "What changed in Nik'Os"),
    audit.length
      ? el("div", { class: "audit-list" }, audit.map((entry) => el("div", { class: "audit-event" }, [
          el("span", { class: "audit-dot", "aria-hidden": "true" }),
          el("span", {}, [
            el("strong", { text: `${auditLabel(entry.action)}: ${entry.name || "—"}` }),
            el("small", { text: formatDate(entry.at, "medium") })
          ])
        ])))
      : emptyState(t("cmd.recentEmpty"))));

  return page;
}

function auditLabel(action) {
  const labels = {
    created: ["Создано", "Created"], updated: ["Изменено", "Updated"], confirmed: ["Подтверждено", "Confirmed"],
    archived: ["В архив", "Archived"], deleted: ["Удалено", "Deleted"], restored: ["Восстановлено", "Restored"],
    purged: ["Удалено навсегда", "Purged"], imported: ["Импортировано", "Imported"], migrated: ["Перенесено", "Migrated"]
  };
  const pair = labels[action];
  return pair ? (ru() ? pair[0] : pair[1]) : action;
}
