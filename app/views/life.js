/* Assets, Health & sport, Documents, People, Decisions, Timeline. */

import { el, panel, panelHeader, metricCard, emptyState, toast } from "../ui.js?v=20260827-084202";
import { t, getLocale, formatDate, relativeDays, countOf, plural, PLURALS, categoryLabel,
         statusLabel, formatNumber, typeLabel } from "../i18n.js?v=20260827-084202";
import { formatMoney } from "../money.js?v=20260827-084202";
import { netWorth, periodRange, sportSummary } from "../finance.js?v=20260827-084202";
import { categoriesOf } from "../schema.js?v=20260827-084202";
import { recordList, recordRow, addButton, pageHeading, refresh, chipRow, sparkline } from "../render.js?v=20260827-084202";
import { openRecordForm } from "../form.js?v=20260827-084202";
import { importCsv } from "../csv.js?v=20260827-084202";
import { openLabPaste, labPanels, analyteHistory, rangeVerdict, verdictLabel } from "../labs.js?v=20260827-084202";
import { buildDays, comparePeriods, judge, dayTone, metricOf, monthlySeries, coverage, DAY_METRICS } from "../health-days.js?v=20260827-084202";
import { healthInsights, DISCLAIMER } from "../insights.js?v=20260827-084202";
import * as store from "../store.js?v=20260827-084202";
import * as records from "../records.js?v=20260827-084202";

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

const healthState = { tab: "overview", days: 30, expandedDay: null, showRaw: false };

const DAY_LENGTHS = [
  { value: 7, key: "health.week7" },
  { value: 30, key: "health.month" },
  { value: 90, key: "health.quarter" }
];

export function healthView() {
  const all = store.liveRecords();
  const days = buildDays(all);
  const summary = comparePeriods(days, healthState.days);
  const workouts = store.recordsOfType("workout");
  const measurements = store.recordsOfType("measurement");
  const healthRecords = store.recordsOfType("health");
  const labs = store.recordsOfType("lab");
  const panels = labPanels(labs);
  const flagged = panels.flatMap((panel) => panel.outOfRange);

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.health"), t("health.contextNotDiagnosis"),
    [el("button", { class: "ghost-button", type: "button", text: `＋ ${t("health.pasteLab")}`,
                    onclick: () => openLabPaste({ onDone: refresh }) }),
     el("button", { class: "ghost-button", type: "button", text: `＋ ${t("health.logMeasurement")}`,
                    onclick: () => openRecordForm("measurement", null, { onSaved: refresh }) }),
     addButton("workout", t("health.logWorkout"), refresh)]));

  page.append(el("div", { class: "segmented wide" }, [
    tab("overview", t("health.overview")),
    tab("byday", `${t("health.byDay")} (${days.length})`),
    tab("sport", `${t("health.workouts")} (${workouts.length})`),
    tab("labs", `${t("health.labs")} (${labs.length})`),
    tab("records", `${typeLabel("health")} (${healthRecords.length})`)
  ]));

  if (healthState.tab === "overview") page.append(overviewPanel());
  else if (healthState.tab === "byday") page.append(byDayPanel());
  else if (healthState.tab === "sport") page.append(sportPanel());
  else if (healthState.tab === "labs") page.append(labsPanel());
  else page.append(recordsPanel());

  return page;

  function tab(value, label) {
    return el("button", {
      class: `seg-button${healthState.tab === value ? " selected" : ""}`, type: "button", text: label,
      onclick: () => { healthState.tab = value; refresh(); }
    });
  }

  function periodChips() {
    return chipRow(DAY_LENGTHS.map((item) => ({ value: item.value, label: t(item.key) })),
      healthState.days, (value) => { healthState.days = Number(value); refresh(); });
  }

  /* ---------- Overview: how this period went, against the one before ---------- */

  function overviewPanel() {
    if (!days.length) {
      return panel("records-panel",
        panelHeader(ru() ? "ОБЗОР" : "OVERVIEW", ru() ? "Тело за период" : "Your body over time"),
        emptyState(t("cmd.sportEmpty"), t("health.logWorkout"),
          () => openRecordForm("workout", null, { onSaved: refresh })));
    }

    const host = document.createDocumentFragment();
    host.append(periodChips());

    const cards = DAY_METRICS
      .map((metric) => ({ metric, ...summary[metric.key] }))
      .filter((entry) => entry.value !== null)
      .map((entry) => {
        const cover = coverage(days, entry.metric.key, healthState.days);
        const unit = entry.metric.unit ? ` ${entry.metric.unit}` : "";

        /* A difference smaller than the precision shown reads as "-0 worse",
           which is both wrong and alarming. Below that threshold it is no
           change at all. */
        const step = 10 ** -entry.metric.digits;
        const shown = entry.delta === null || Math.abs(entry.delta) < step / 2 ? null : entry.delta;
        const verdict = shown === null ? "flat" : judge(entry.metric.key, shown);

        return el("div", { class: `metric-card day-metric ${verdict}` }, [
          el("span", { class: "panel-kicker", text: ru() ? entry.metric.ru : entry.metric.en }),
          el("strong", { text: `${formatNumber(entry.value, entry.metric.digits)}${unit}` }),
          shown !== null
            ? el("small", { class: `delta ${verdict}`,
                            text: `${shown > 0 ? "+" : "−"}${formatNumber(Math.abs(shown), entry.metric.digits)} ${t("health.vsPrevious")}` })
            : entry.delta !== null
              ? el("small", { class: "delta flat", text: t("health.noChange") })
              : el("small", { text: `${countOf(cover.known, PLURALS.day)} ${ru() ? "с данными" : "with data"}` })
        ]);
      });

    const workoutDelta = summary.workouts.delta;
    cards.unshift(el("div", { class: "metric-card day-metric" }, [
      el("span", { class: "panel-kicker", text: t("health.workouts") }),
      el("strong", { text: String(summary.workouts.value) }),
      el("small", { class: `delta ${workoutDelta > 0 ? "better" : workoutDelta < 0 ? "worse" : "flat"}`,
                    text: workoutDelta === 0
                      ? t("health.noChange")
                      : `${workoutDelta > 0 ? "+" : "−"}${Math.abs(workoutDelta)} ${t("health.vsPrevious")}` })
    ]));

    host.append(el("div", { class: "metric-grid" }, cards));

    const observations = healthInsights(days, all, { locale: getLocale() });
    if (observations.length) {
      host.append(panel("insight-panel",
        panelHeader(ru() ? "ЧТО ВИДНО В ЦИФРАХ" : "WHAT THE NUMBERS SHOW",
          ru() ? "Наблюдения, а не советы" : "Observations, not advice"),
        el("div", { class: "insight-list" }, observations.map((item) =>
          el("div", { class: `insight tone-${item.tone}` }, [
            el("span", { class: "insight-mark", "aria-hidden": "true",
                         text: item.tone === "warn" ? "!" : item.tone === "good" ? "↗" : "·" }),
            el("span", {}, [
              el("strong", { text: item.title }),
              el("p", { text: item.text }),
              el("small", { text: item.sample })
            ])
          ]))),
        el("p", { class: "panel-note", text: ru() ? DISCLAIMER.ru : DISCLAIMER.en })));
    }

    /* Twelve months at a glance beats a thousand points of noise. */
    const trends = DAY_METRICS
      .map((metric) => ({ metric, series: monthlySeries(days, metric.key) }))
      .filter((trend) => trend.series.length > 1);

    if (trends.length) {
      host.append(panel("trend-panel",
        panelHeader(ru() ? "ДИНАМИКА" : "TRENDS", `${ru() ? "Как меняется" : "How it moves"} · ${t("health.byMonth")}`),
        el("div", { class: "trend-grid" }, trends.map((trend) => el("div", { class: "trend-card" }, [
          el("span", { class: "panel-kicker", text: ru() ? trend.metric.ru : trend.metric.en }),
          sparkline(trend.series, { tone: trend.metric.good === "low" ? "amber" : "cyan" }),
          el("div", { class: "trend-foot" }, [
            el("b", { text: `${formatNumber(trend.series.at(-1).value, trend.metric.digits)} ${trend.metric.unit}` }),
            el("small", { text: `${trend.series.length} ${ru() ? "мес." : "mo"}` })
          ])
        ])))));
    }

    if (flagged.length) {
      host.append(panel("records-panel lab-flagged",
        panelHeader(ru() ? "ВНЕ НОРМЫ" : "OUT OF RANGE", ru() ? "Из последних анализов" : "From recent lab results",
          el("span", { class: "security-badge", text: String(flagged.length) })),
        el("div", { class: "lab-table" }, flagged
          .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6).map(labLine)),
        el("p", { class: "panel-note", text: t("health.notDiagnosis") })));
    }

    return host;
  }

  /* ---------- By day: one card per day, the way a wearable shows it ---------- */

  function byDayPanel() {
    const shown = days.slice(0, healthState.days);
    return panel("records-panel",
      panelHeader(ru() ? "ПО ДНЯМ" : "BY DAY", `${countOf(shown.length, PLURALS.day)} ${ru() ? "с данными" : "with data"}`),
      periodChips(),
      el("div", { class: "day-list" }, shown.map(dayCard)));
  }

  function dayCard(entry) {
    const open = healthState.expandedDay === entry.date;
    const weekday = new Intl.DateTimeFormat(ru() ? "ru-RU" : "en-US", { weekday: "long" })
      .format(new Date(`${entry.date}T12:00:00`));

    const chips = DAY_METRICS
      .filter((metric) => metricOf(entry, metric.key) !== null)
      .map((metric) => el("span", { class: "day-chip" }, [
        el("small", { text: ru() ? metric.ru : metric.en }),
        el("b", { text: `${formatNumber(metricOf(entry, metric.key), metric.digits)}${metric.unit ? ` ${metric.unit}` : ""}` })
      ]));

    return el("div", { class: `day-card tone-${dayTone(entry)}${open ? " open" : ""}` }, [
      el("button", {
        class: "day-head", type: "button", "aria-expanded": String(open),
        onclick: () => { healthState.expandedDay = open ? null : entry.date; refresh(); }
      }, [
        el("span", { class: "day-date" }, [
          el("strong", { text: formatDate(entry.date, "short") }),
          el("small", { text: weekday })
        ]),
        el("span", { class: "day-chips" }, chips.length ? chips : [el("small", { class: "muted-text", text: t("health.noReading") })]),
        entry.workouts.length
          ? el("span", { class: "day-workouts", text: `${entry.workouts.length} · ${formatNumber(entry.minutes)} ${ru() ? "мин" : "min"}` })
          : el("span", { class: "day-workouts muted-text", text: "—" })
      ]),
      open
        ? el("div", { class: "day-detail" }, [
            entry.workouts.length
              ? el("div", { class: "record-list" }, entry.workouts.map((record) => recordRow(record, { compact: true })))
              : null,
            el("button", {
              class: "text-button", type: "button",
              text: healthState.showRaw ? t("health.hideRaw") : t("health.showRaw"),
              onclick: () => { healthState.showRaw = !healthState.showRaw; refresh(); }
            }),
            healthState.showRaw
              ? el("div", { class: "record-list" }, all
                  .filter((record) => record.type === "measurement" && record.date === entry.date)
                  .map((record) => recordRow(record, { compact: true })))
              : null
          ])
        : null
    ]);
  }

  /* ---------- The remaining tabs ---------- */

  function sportPanel() {
    return panel("records-panel",
      panelHeader(ru() ? "ТРЕНИРОВКИ" : "WORKOUTS", countOf(workouts.length, PLURALS.workout)),
      recordList("health-workouts", sortByDate(workouts), {
        empty: ru() ? "Запишите первую тренировку — зал, бег, что угодно." : "Log your first workout.",
        addType: "workout"
      }));
  }

  function recordsPanel() {
    const host = document.createDocumentFragment();
    host.append(panel("records-panel",
      panelHeader(ru() ? "ЗДОРОВЬЕ" : "HEALTH", ru() ? "Осмотры, лекарства, состояния" : "Check-ups, medication, conditions"),
      recordList("health-records", sortByDate(healthRecords), {
        empty: ru() ? "Добавьте осмотр, лекарство или состояние." : "Add a check-up, a medication or a condition.",
        addType: "health"
      })));
    host.append(panel("records-panel",
      panelHeader(ru() ? "ПОКАЗАТЕЛИ" : "MEASUREMENTS", countOf(measurements.length, PLURALS.record),
        el("button", { class: "small-button", type: "button", text: t("health.importCsv"),
                       onclick: () => importCsv({ onDone: refresh }) })),
      recordList("health-measurements", sortByDate(measurements), {
        empty: ru() ? "Добавьте вес, сон или пульс покоя — или импортируйте CSV." : "Add weight, sleep or resting heart rate — or import a CSV.",
        addType: "measurement"
      })));
    return host;
  }

  function labsPanel() {
    if (!panels.length) {
      return panel("records-panel",
        panelHeader(ru() ? "АНАЛИЗЫ" : "LAB RESULTS", ru() ? "Результаты из лаборатории" : "Results from the laboratory"),
        emptyState(ru()
          ? "Откройте PDF из лаборатории, скопируйте таблицу с результатами и вставьте — Nik'Os разберёт её сам."
          : "Open the lab PDF, copy the results table and paste it — Nik'Os will parse it.",
          t("health.pasteLab"), () => openLabPaste({ onDone: refresh })));
    }

    const host = document.createDocumentFragment();
    if (flagged.length) {
      host.append(panel("records-panel lab-flagged",
        panelHeader(ru() ? "ВНЕ НОРМЫ" : "OUT OF RANGE", ru() ? "На что посмотреть с врачом" : "Worth reviewing with a doctor",
          el("span", { class: "security-badge", text: String(flagged.length) })),
        el("div", { class: "lab-table" }, flagged
          .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12).map(labLine)),
        el("p", { class: "panel-note", text: t("health.notDiagnosis") })));
    }
    for (const group of panels.slice(0, 8)) {
      host.append(panel("records-panel",
        panelHeader(formatDate(group.date, "long").toUpperCase(),
          group.lab || (ru() ? "Лаборатория не указана" : "Laboratory not recorded"),
          el("span", { class: "muted-text", text: group.outOfRange.length
            ? `${group.outOfRange.length} ${t("health.outOfRange")}` : t("health.inRange") })),
        el("div", { class: "lab-table" }, group.items.map(labLine))));
    }
    return host;
  }

  function labLine(record) {
    const verdict = rangeVerdict(record);
    const history = analyteHistory(all, record.name);
    const index = history.findIndex((item) => item.record.id === record.id);
    const previous = index > 0 ? history[index - 1] : null;
    const delta = previous ? Number(record.value) - previous.value : null;

    return el("button", {
      class: `lab-line${verdict && verdict !== "in" ? ` off ${verdict}` : ""}`, type: "button",
      onclick: () => openRecordForm("lab", record, { onSaved: refresh })
    }, [
      el("span", { class: "lab-line-name" }, [
        el("strong", { text: record.name }),
        el("small", { text: [categoryLabel("lab", record.category), record.counterparty].filter(Boolean).join(" · ") })
      ]),
      history.length > 1 ? sparkline(history.slice(-12), { tone: verdict && verdict !== "in" ? "amber" : "cyan" }) : null,
      el("span", { class: "lab-line-value" }, [
        el("b", { text: `${formatNumber(record.value, 2)}${record.unit ? ` ${record.unit}` : ""}` }),
        delta !== null && Math.abs(delta) > 1e-9
          ? el("small", { class: "lab-delta", text: `${delta > 0 ? "+" : ""}${formatNumber(delta, 2)}` }) : null
      ]),
      el("span", { class: "lab-line-ref" }, [
        el("small", { text: record.refLow !== null || record.refHigh !== null
          ? `${record.refLow ?? "—"} – ${record.refHigh ?? "—"}` : "—" }),
        verdict && verdict !== "in" ? el("em", { text: verdictLabel(verdict) }) : null
      ])
    ]);
  }
}

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
