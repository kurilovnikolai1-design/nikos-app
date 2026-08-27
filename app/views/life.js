/* Assets, Health & sport, Documents, People, Decisions, Timeline. */

import { el, panel, panelHeader, metricCard, emptyState, toast, openDialog } from "../ui.js?v=20260827-135827";
import { t, getLocale, formatDate, relativeDays, countOf, plural, PLURALS, categoryLabel,
         statusLabel, formatNumber, typeLabel, ownerLabel } from "../i18n.js?v=20260827-135827";
import { formatMoney } from "../money.js?v=20260827-135827";
import { netWorth, periodRange, sportSummary } from "../finance.js?v=20260827-135827";
import { categoriesOf } from "../schema.js?v=20260827-135827";
import { recordList, recordRow, addButton, pageHeading, refresh, chipRow, sparkline } from "../render.js?v=20260827-135827";
import { openRecordForm } from "../form.js?v=20260827-135827";
import { navigate } from "../router.js?v=20260827-135827";
import { importCsv } from "../csv.js?v=20260827-135827";
import { openLabPaste, openProcedurePaste, rangeVerdict, verdictLabel } from "../labs.js?v=20260827-135827";
import { byAnalyte, currentlyOutOfRange } from "../labs-parse.js?v=20260827-135827";
import { labInsights, LAB_DISCLAIMER } from "../lab-insights.js?v=20260827-135827";
import { routeFor, groupBySpecialist, ROUTING_NOTE } from "../lab-routing.js?v=20260827-135827";
import { conditionPanels, offerableConditions, CONDITION_NOTE } from "../conditions.js?v=20260827-135827";
import { partitionByResolution, resolutions, resolutionState, resolutionPreset, RESOLVED_NOTE } from "../resolved.js?v=20260827-135827";
import { byExercise, weeklyVolume, freshRecords, TRAINING_NOTE } from "../training.js?v=20260827-135827";
import { describe as describeAnalyte, SOURCE as DESC_SOURCE } from "../lab-descriptions.js?v=20260827-135827";
import { buildDays, comparePeriods, judge, dayTone, metricOf, monthlySeries, coverage, DAY_METRICS } from "../health-days.js?v=20260827-135827";
import { healthInsights, DISCLAIMER } from "../insights.js?v=20260827-135827";
import * as store from "../store.js?v=20260827-135827";
import * as records from "../records.js?v=20260827-135827";

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
const labState = { tab: "analytes", query: "", panel: "all", onlyOff: false };

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
  // Each analyte counted once, at its current state — not once per visit.
  const flagged = currentlyOutOfRange(all);

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.health"), t("health.contextNotDiagnosis"),
    [el("button", { class: "ghost-button", type: "button", text: `＋ ${t("health.logMeasurement")}`,
                    onclick: () => openRecordForm("measurement", null, { onSaved: refresh }) }),
     addButton("workout", t("health.logWorkout"), refresh)]));

  page.append(el("div", { class: "segmented wide" }, [
    tab("overview", t("health.overview")),
    tab("byday", `${t("health.byDay")} (${days.length})`),
    tab("sport", `${t("health.workouts")} (${workouts.length})`)
  ]));

  if (healthState.tab === "byday") page.append(byDayPanel());
  else if (healthState.tab === "sport") page.append(sportPanel());
  else page.append(overviewPanel());

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
        el("div", { class: "flagged-strip" }, flagged.slice(0, 6).map((group) => el("button", {
          class: `flagged-chip ${group.verdict}`, type: "button",
          onclick: () => navigate("labs")
        }, [
          el("strong", { text: group.name }),
          el("small", { text: `${formatNumber(group.latest.value, 2)} ${group.latest.unit || ""}`.trim() })
        ]))),
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
    const host = document.createDocumentFragment();
    const exercises = byExercise(workouts);

    /* A personal best is the reason anyone keeps a log, so it goes first. */
    const fresh = freshRecords(workouts);
    if (fresh.length) {
      host.append(panel("records-panel",
        panelHeader(ru() ? "НОВЫЕ РЕКОРДЫ" : "NEW BESTS",
          ru() ? "За последний месяц" : "In the last month",
          el("span", { class: "security-badge", text: String(fresh.length) })),
        el("div", { class: "pr-list" }, fresh.map((item) => el("div", { class: "pr-row" }, [
          el("strong", { text: item.name }),
          el("b", { text: `${formatNumber(item.weight, 1)} ${ru() ? "кг" : "kg"}` }),
          el("time", { datetime: item.date, text: formatDate(item.date, "medium") })
        ])))));
    }

    if (exercises.length) {
      const volume = weeklyVolume(workouts, { weeks: 8 });
      const lifted = volume.some((week) => week.volume > 0);

      host.append(panel("records-panel",
        panelHeader(ru() ? "ПРОГРЕССИЯ" : "PROGRESSION",
          ru() ? `${exercises.length} ${plural(exercises.length, PLURALS.exercise)}` : `${exercises.length} exercises`),

        lifted ? el("div", { class: "volume-chart" }, [
          el("span", { class: "panel-kicker", text: ru() ? "ОБЪЁМ ПО НЕДЕЛЯМ, КГ" : "WEEKLY VOLUME, KG" }),
          sparkline(volume.map((week) => ({ date: week.from, value: week.volume })), { tone: "cyan", height: 70 })
        ]) : null,

        el("div", { class: "exercise-list" }, exercises.map((group) => el("div", {
          class: `exercise-row${group.trend?.direction === "up" ? " up" : ""}${group.trend?.direction === "down" ? " down" : ""}`
        }, [
          el("div", { class: "exercise-head" }, [
            el("strong", { text: group.name }),
            el("span", { class: "exercise-best", text: group.heaviest?.bestWeight !== null && group.heaviest
              ? `${formatNumber(group.heaviest.bestWeight, 1)} ${ru() ? "кг" : "kg"}`
              : `${group.latest.reps} ${ru() ? "повт." : "reps"}` })
          ]),
          el("small", { class: "exercise-note", text: (() => {
            /* A Russian medium date already ends in "г.", so appending a full
               stop produced "23 авг. 2026 г..". */
            const noDot = (date) => formatDate(date, "medium").replace(/\.$/, "");
            const when = noDot(group.lastDate);
            const base = ru()
              ? `${countOf(group.count, PLURALS.workout)}, последняя ${when}`
              : `${group.count} sessions, last ${when}`;
            if (!group.trend) {
              return group.count < 3
                ? `${base}. ${ru() ? "Для направления нужна третья тренировка." : "A third session is needed to show direction."}`
                : base;
            }
            const change = group.trend.changeKg;
            const word = change > 0 ? (ru() ? "прибавка" : "up") : change < 0 ? (ru() ? "снижение" : "down") : (ru() ? "без изменений" : "flat");
            return change === 0
              ? `${base}. ${word}.`
              : `${base}. ${word} ${formatNumber(Math.abs(change), 1)} ${ru() ? "кг" : "kg"} ${ru() ? "с" : "since"} ${noDot(group.trend.from)}.`;
          })() })
        ]))),

        el("p", { class: "panel-note", text: ru() ? TRAINING_NOTE.ru : TRAINING_NOTE.en })));
    }

    host.append(panel("records-panel",
      panelHeader(ru() ? "ТРЕНИРОВКИ" : "WORKOUTS", countOf(workouts.length, PLURALS.workout)),
      recordList("health-workouts", sortByDate(workouts), {
        empty: ru() ? "Запишите первую тренировку — зал, бег, что угодно." : "Log your first workout.",
        addType: "workout"
      })));

    return host;
  }

  function recordsPanel() {
    const host = document.createDocumentFragment();
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
}

/* ---------- Labs & medical ---------- */

/* Split out of the health screen: five tabs in one row mixed two unrelated
   things — how the body is doing day to day, and what a laboratory measured.
   They are opened at different moments, for different reasons. */
export function labsView() {
  const all = store.liveRecords();
  const labs = store.recordsOfType("lab");
  const healthRecords = store.recordsOfType("health");

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.labs"),
    ru() ? "Результаты, осмотры и лекарства — с историей по каждому показателю."
         : "Results, check-ups and medication — with a history for every analyte.",
    [el("button", { class: "ghost-button", type: "button", text: `＋ ${typeLabel("health")}`,
                    onclick: () => openRecordForm("health", null, { onSaved: refresh }) }),
     el("button", { class: "ghost-button", type: "button",
                    text: ru() ? "＋ Выписка" : "＋ Report",
                    onclick: () => openProcedurePaste({ onDone: refresh }) }),
     el("button", { class: "primary-button", type: "button", text: `＋ ${t("health.pasteLab")}`,
                    onclick: () => openLabPaste({ onDone: refresh }) })]));

  page.append(el("div", { class: "segmented wide" }, [
    labTab("analytes", `${t("health.labs")} (${new Set(labs.map((record) => record.name)).size})`),
    labTab("records", `${typeLabel("health")} (${healthRecords.length})`)
  ]));

  page.append(labState.tab === "records" ? medicalRecordsPanel() : labsPanel());
  return page;

  function labTab(value, label) {
    return el("button", {
      class: `seg-button${labState.tab === value ? " selected" : ""}`, type: "button", text: label,
      onclick: () => { labState.tab = value; refresh(); }
    });
  }

  function medicalRecordsPanel() {
    return panel("records-panel",
      panelHeader(ru() ? "ОСМОТРЫ И ЛЕКАРСТВА" : "CHECK-UPS AND MEDICATION",
        ru() ? "Клинический контекст" : "Clinical context"),
      recordList("medical-records", sortByDate(healthRecords), {
        empty: ru() ? "Добавьте осмотр, лекарство, диагноз или прививку." : "Add a check-up, medication, diagnosis or vaccination.",
        addType: "health"
      }),
      el("p", { class: "panel-note", text: t("health.notDiagnosis") }));
  }

  /* ---------- Lab results, organised by analyte ---------- */

  function labsPanel() {
    const groups = byAnalyte(all);

    if (!groups.length) {
      return panel("records-panel",
        panelHeader(ru() ? "АНАЛИЗЫ" : "LAB RESULTS", ru() ? "Результаты из лаборатории" : "Results from the laboratory"),
        emptyState(ru()
          ? "Откройте PDF из лаборатории, скопируйте таблицу с результатами и вставьте — Nik'Os разберёт её сам."
          : "Open the lab PDF, copy the results table and paste it — Nik'Os will parse it.",
          t("health.pasteLab"), () => openLabPaste({ onDone: refresh })));
    }

    const query = labState.query.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      if (labState.panel !== "all" && group.category !== labState.panel) return false;
      if (labState.onlyOff && !["above", "below"].includes(group.verdict)) return false;
      return !query || group.name.toLowerCase().includes(query);
    });

    const offCount = groups.filter((group) => ["above", "below"].includes(group.verdict)).length;
    const dates = [...new Set(all.filter((r) => r.type === "lab" && r.date).map((r) => r.date))];

    const host = document.createDocumentFragment();

    host.append(conditionsPanel());

    /* Nine deviations read as nine problems. Grouped by who reads them they
       read as three appointments, which is what they actually are. */
    const flagged = groups.filter((group) => ["above", "below"].includes(group.verdict));
    const { active: off, resolved } = partitionByResolution(flagged, all);

    if (off.length) {
      const buckets = groupBySpecialist(off, getLocale());
      host.append(panel("records-panel routing-panel",
        panelHeader(ru() ? "К КОМУ ИДТИ" : "WHO TO SEE",
          ru() ? `${off.length} ${plural(off.length, PLURALS.analyte)} вне нормы` : `${off.length} analytes outside the range`,
          el("span", { class: "security-badge", text: String(buckets.length) })),
        el("div", { class: "routing-list" }, buckets.map((bucket) => el("div", { class: "routing-item" }, [
          el("div", { class: "routing-head" }, [
            el("strong", { text: bucket.specialist }),
            el("small", { text: bucket.systems.join(" · ") })
          ]),
          el("div", { class: "routing-analytes" }, bucket.analytes.map((group) => el("button", {
            class: `chip ${group.verdict}`, type: "button",
            text: `${group.name} · ${formatNumber(group.latest.value, 2)}${group.unit ? ` ${group.unit}` : ""}`,
            onclick: () => openAnalyte(group)
          })))
        ]))),
        el("p", { class: "panel-note", text: ru() ? ROUTING_NOTE.ru : ROUTING_NOTE.en })));
    }

    /* Dealt with, and still visible. Hiding a treated finding entirely would
       make it impossible to notice that nothing ever confirmed the treatment. */
    if (resolved.length) {
      host.append(panel("records-panel resolved-panel",
        panelHeader(ru() ? "УЖЕ РАЗОБРАЛИСЬ" : "ALREADY DEALT WITH",
          ru() ? "Отмечено вами как пролеченное" : "Marked by you as treated",
          el("span", { class: "security-badge", text: String(resolved.length) })),
        el("div", { class: "routing-list" }, resolved.map(({ group, state }) => el("button", {
          class: `resolved-row${state.unconfirmed ? " unconfirmed" : ""}`, type: "button",
          onclick: () => openAnalyte(group)
        }, [
          el("span", { class: "resolved-name", text: group.name }),
          el("small", { text: ru()
            ? `отмечено ${formatDate(state.date, "medium")}`
            : `marked ${formatDate(state.date, "medium")}` }),
          state.confirmed
            ? el("em", { class: "good", text: ru() ? "пересдано, в норме" : "retested, in range" })
            : el("em", { text: ru() ? "после этого не пересдавали" : "not retested since" })
        ]))),
        el("p", { class: "panel-note", text: ru() ? RESOLVED_NOTE.ru : RESOLVED_NOTE.en })));
    }

    const observations = labInsights(all, { locale: getLocale() });
    if (observations.length) {
      host.append(panel("insight-panel",
        panelHeader(ru() ? "ЧТО ВИДНО В ЦИФРАХ" : "WHAT THE NUMBERS SHOW",
          ru() ? "Наблюдения, а не толкование" : "Observations, not interpretation"),
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
        el("p", { class: "panel-note", text: ru() ? LAB_DISCLAIMER.ru : LAB_DISCLAIMER.en })));
    }

    host.append(el("div", { class: "metric-grid" }, [
      metricCard({ kicker: ru() ? "ПОКАЗАТЕЛЕЙ" : "ANALYTES", value: String(groups.length),
                   note: ru()
                     ? `${dates.length} ${plural(dates.length, { ru: { one: "сдача", few: "сдачи", many: "сдач", other: "сдачи" }, en: { one: "visit", other: "visits" } })}`
                     : `${dates.length} visits` }),
      metricCard({ kicker: ru() ? "СЕЙЧАС ВНЕ НОРМЫ" : "OUT OF RANGE NOW", value: String(offCount),
                   note: ru() ? "по последней сдаче" : "at the latest reading",
                   tone: offCount ? "negative" : "positive" }),
      metricCard({ kicker: ru() ? "С ИСТОРИЕЙ" : "WITH HISTORY",
                   value: String(groups.filter((group) => group.count > 1).length),
                   note: ru() ? "можно смотреть динамику" : "trend available" })
    ]));

    const search = el("input", {
      class: "form-control", type: "search", value: labState.query,
      placeholder: ru() ? "Найти показатель — гемоглобин, ферритин…" : "Find an analyte…",
      oninput: (event) => { labState.query = event.target.value; renderList(); }
    });

    const usedPanels = [...new Set(groups.map((group) => group.category))];
    const chips = chipRow([
      { value: "all", label: t("app.all"), count: groups.length },
      ...usedPanels.map((key) => ({
        value: key, label: categoryLabel("lab", key),
        count: groups.filter((group) => group.category === key).length
      }))
    ], labState.panel, (value) => { labState.panel = value; refresh(); });

    const onlyOff = el("label", { class: "switch-row" }, [
      el("input", {
        type: "checkbox", checked: labState.onlyOff ? "checked" : null,
        onchange: (event) => { labState.onlyOff = event.target.checked; refresh(); }
      }),
      el("span", { text: ru() ? `Только вне нормы (${offCount})` : `Only out of range (${offCount})` })
    ]);

    const list = el("div", { class: "analyte-list" });
    const renderList = () => {
      const q = labState.query.trim().toLowerCase();
      const shown = groups.filter((group) => {
        if (labState.panel !== "all" && group.category !== labState.panel) return false;
        if (labState.onlyOff && !["above", "below"].includes(group.verdict)) return false;
        return !q || group.name.toLowerCase().includes(q);
      });
      list.replaceChildren(...(shown.length
        ? shown.map(analyteRow)
        : [emptyState(ru() ? "Ничего не нашлось." : "Nothing found.")]));
    };

    host.append(panel("records-panel",
      panelHeader(ru() ? "ПОКАЗАТЕЛИ" : "ANALYTES",
        ru() ? "Нажмите, чтобы увидеть всю историю" : "Open one to see its whole history"),
      el("div", { class: "lab-toolbar" }, [search, onlyOff]),
      chips,
      list,
      el("p", { class: "panel-note", text: t("health.notDiagnosis") })));

    renderList();
    host.querySelector(".analyte-list") && list.replaceChildren(...filtered.map(analyteRow));
    return host;
  }

  /* A one-sided range reads as "до 50", not "— – 50". */
  function rangeText(record) {
    const low = record.refLow;
    const high = record.refHigh;
    if (low !== null && low !== undefined && high !== null && high !== undefined) {
      return `${formatNumber(low, 2)} – ${formatNumber(high, 2)}`;
    }
    if (high !== null && high !== undefined) return `${ru() ? "до" : "up to"} ${formatNumber(high, 2)}`;
    if (low !== null && low !== undefined) return `${ru() ? "от" : "from"} ${formatNumber(low, 2)}`;
    return null;
  }

  /* One line per analyte: where it stands now, and where it has been. */
  function analyteRow(group) {
    const off = ["above", "below"].includes(group.verdict);
    const unit = group.unit ? ` ${group.unit}` : "";
    const range = rangeText(group.latest);

    return el("button", {
      class: `analyte-row${off ? ` off ${group.verdict}` : ""}`, type: "button",
      onclick: () => openAnalyte(group)
    }, [
      el("span", { class: "analyte-name" }, [
        el("strong", { text: group.name }),
        el("small", { text: [categoryLabel("lab", group.category),
          `${group.count} ${plural(group.count, { ru: { one: "измерение", few: "измерения", many: "измерений", other: "измерения" }, en: { one: "reading", other: "readings" } })}`
        ].join(" · ") })
      ]),
      group.comparable.length > 1
        ? sparkline(group.comparable.map((item) => ({ date: item.date, value: Number(item.value) })),
                    { tone: off ? "amber" : "cyan" })
        : el("span", { class: "analyte-nochart" }),
      el("span", { class: "analyte-value" }, [
        el("b", { text: `${formatNumber(group.latest.value, 2)}${unit}` }),
        el("small", { text: formatDate(group.latest.date, "short") })
      ]),
      el("span", { class: "analyte-ref" }, [
        range ? el("small", { text: range }) : el("small", { class: "muted-text", text: ru() ? "нормы нет" : "no range" }),
        off ? el("em", { text: verdictLabel(group.verdict) }) : null
      ])
    ]);
  }

  /* What is tracked alongside a condition the owner has written down.
     Conditions are never inferred from results — only read from his own
     records — and the only judgement made here is about the calendar. */
  function conditionsPanel() {
    const panels = conditionPanels(all, { locale: getLocale() });

    if (!panels.length) {
      const offers = offerableConditions(all, getLocale()).slice(0, 6);
      return panel("records-panel conditions-panel",
        panelHeader(ru() ? "ВАШИ СОСТОЯНИЯ" : "YOUR CONDITIONS",
          ru() ? "Чтобы видеть, что по ним отслеживают" : "To see what is tracked for them"),
        el("p", { class: "panel-note", text: ru()
          ? "Отметьте, что у вас есть — Nik'Os покажет, какие показатели при этом обычно смотрят и когда вы сдавали их в последний раз."
          : "Mark what you have and Nik'Os will show which analytes are usually tracked and when you last had them done." }),
        el("div", { class: "routing-analytes" }, offers.map((offer) => el("button", {
          class: "chip", type: "button", text: `＋ ${offer.name}`,
          onclick: () => openRecordForm("health", null, {
            presets: { category: "condition", name: offer.name, status: "active" },
            onSaved: refresh
          })
        }))));
    }

    const host = document.createDocumentFragment();
    for (const item of panels) {
      host.append(panel("records-panel conditions-panel",
        panelHeader(item.name.toUpperCase(),
          item.hereditary && item.owners.length > 1
            ? `${item.specialist} · ${ru() ? "в семье" : "in the family"}: ${item.owners.map((owner) => ownerLabel(owner)).join(", ")}`
            : item.specialist,
          item.overdueCount
            ? el("span", { class: "security-badge warn", text: String(item.overdueCount) })
            : null),
        el("div", { class: "condition-tracked" }, item.tracked.map((entry) => el("button", {
          class: `condition-row${entry.overdue ? " overdue" : ""}`, type: "button",
          onclick: () => openAnalyte(entry.group)
        }, [
          el("span", { class: "condition-label", text: entry.label }),
          el("b", { text: `${formatNumber(entry.value, 2)}${entry.unit ? ` ${entry.unit}` : ""}` }),
          el("time", { datetime: entry.date, text: formatDate(entry.date, "medium") }),
          entry.overdue
            ? el("em", { text: ru()
                ? `${Math.round(entry.days / 30)} мес. назад`
                : `${Math.round(entry.days / 30)} months ago` })
            : null
        ]))),
        item.missing.length
          ? el("p", { class: "panel-note", text: ru()
              ? `Ни разу не сдавали: ${item.missing.join(", ")}.`
              : `Never taken: ${item.missing.join(", ")}.` })
          : null,
        item.hereditary
          ? el("p", { class: "panel-note", text: ru()
              ? "Состояние наследственное. Ниже — только ваши собственные результаты; у родственников свои анализы и свой график наблюдения."
              : "This condition is hereditary. The results below are yours alone; relatives have their own tests and their own schedule." })
          : null,
        el("p", { class: "panel-note", text: ru() ? CONDITION_NOTE.ru : CONDITION_NOTE.en })));
    }
    return host;
  }

  /* The laboratory's own detail view: the whole history as a chart and a list. */
  function openAnalyte(group) {
    let dialog = null;
    const body = el("div", { class: "analyte-detail" });
    const latest = group.latest;

    const header = el("div", { class: "analyte-summary" }, [
      el("div", {}, [
        el("span", { class: "panel-kicker", text: ru() ? "ПОСЛЕДНЕЕ" : "LATEST" }),
        el("strong", { text: `${formatNumber(latest.value, 2)}${latest.unit ? ` ${latest.unit}` : ""}` }),
        el("small", { text: formatDate(latest.date, "long") })
      ]),
      el("div", {}, [
        el("span", { class: "panel-kicker", text: ru() ? "НОРМА ЛАБОРАТОРИИ" : "LAB RANGE" }),
        el("strong", { text: rangeText(latest) ?? (ru() ? "не указана" : "not given") }),
        el("small", { text: group.verdict && group.verdict !== "in" ? verdictLabel(group.verdict) : (group.verdict === "in" ? t("health.inRange") : "") })
      ]),
      el("div", {}, [
        el("span", { class: "panel-kicker", text: ru() ? "ИЗМЕРЕНИЙ" : "READINGS" }),
        el("strong", { text: String(group.count) }),
        el("small", { text: `${formatDate(group.history[0].date, "medium")} — ${formatDate(latest.date, "medium")}` })
      ])
    ]);
    body.append(header);

    /* Which specialty this belongs to. Administrative, not diagnostic — it
       answers "which door", never "what does my number mean". */
    const route = routeFor(group.name, getLocale());
    if (route) {
      body.append(el("div", { class: "analyte-route" }, [
        el("span", { class: "panel-kicker", text: ru() ? "ОБЫЧНО СМОТРИТ" : "USUALLY READ BY" }),
        el("strong", { text: route.specialist }),
        el("small", { text: route.system })
      ]));
    }

    /* Already dealt with? The state, and the way back out of it. */
    const state = resolutionState(group, resolutions(all));
    if (state) {
      body.append(el("div", { class: `analyte-resolved${state.unconfirmed ? " unconfirmed" : ""}` }, [
        el("span", { class: "panel-kicker", text: ru() ? "ОТМЕЧЕНО КАК ПРОЛЕЧЕННОЕ" : "MARKED AS TREATED" }),
        el("strong", { text: formatDate(state.date, "long") }),
        state.note ? el("p", { text: state.note }) : null,
        el("small", { text: state.confirmed
          ? (ru() ? "После лечения пересдавали — результат в норме." : "Retested after treatment and back in range.")
          : (ru() ? "После этой даты показатель не пересдавали." : "Not retested since that date.") })
      ]));
    } else if (["above", "below"].includes(group.verdict)) {
      body.append(el("div", { class: "analyte-actions" }, [
        el("button", { class: "ghost-button", type: "button",
          text: ru() ? "Уже пролечено" : "Already treated",
          onclick: () => openRecordForm("health", null, {
            presets: resolutionPreset(group),
            onSaved: () => { dialog?.close(); refresh(); }
          }) }),
        el("small", { text: ru()
          ? "История сохранится полностью — уйдёт только пометка «нужно внимание»."
          : "The full history is kept — only the needs-attention flag is dropped." })
      ]));
    }

    /* What the test measures, in the laboratory's own words. Absent for the
       tests KDL itself does not describe — then nothing is shown. */
    const description = describeAnalyte(group.name);
    if (description) {
      body.append(el("div", { class: "analyte-about" }, [
        el("span", { class: "panel-kicker", text: ru() ? "ЧТО ЭТО ЗА АНАЛИЗ" : "WHAT THIS TEST IS" }),
        el("p", { text: description }),
        el("cite", { text: ru() ? DESC_SOURCE.ru : DESC_SOURCE.en })
      ]));
    }

    /* Units changed over the years for some tests; a line across them would be
       meaningless, so each unit gets its own chart — as the laboratory does. */
    const byUnit = new Map();
    for (const item of group.history) {
      const unit = item.unit || "";
      if (!byUnit.has(unit)) byUnit.set(unit, []);
      byUnit.get(unit).push(item);
    }

    for (const [unit, items] of byUnit) {
      if (items.length < 2) continue;
      body.append(el("div", { class: "analyte-chart" }, [
        byUnit.size > 1 ? el("span", { class: "panel-kicker", text: unit || (ru() ? "без единицы" : "no unit") }) : null,
        sparkline(items.map((item) => ({ date: item.date, value: Number(item.value) })),
                  { tone: ["above", "below"].includes(group.verdict) ? "amber" : "cyan", height: 90 })
      ]));
    }

    if (group.unitChanged) {
      body.append(el("p", { class: "panel-note warn", text: ru()
        ? `Лаборатория меняла единицы измерения (${group.units.join(", ")}), поэтому история разбита на отдельные графики.`
        : `The laboratory changed units (${group.units.join(", ")}), so the history is split into separate charts.` }));
    }

    body.append(el("div", { class: "analyte-history" }, [...group.history].reverse().map((item) => {
      const verdict = rangeVerdict(item);
      return el("div", { class: `analyte-reading${verdict && verdict !== "in" ? ` off ${verdict}` : ""}` }, [
        el("span", { class: "reading-dot", "aria-hidden": "true" }),
        el("time", { datetime: item.date, text: formatDate(item.date, "medium") }),
        el("b", { text: `${formatNumber(item.value, 2)}${item.unit ? ` ${item.unit}` : ""}` }),
        el("small", { text: rangeText(item) ?? "—" }),
        verdict && verdict !== "in" ? el("em", { text: verdictLabel(verdict) }) : null
      ]);
    })));

    dialog = openDialog({
      title: group.name,
      subtitle: [categoryLabel("lab", group.category), latest.counterparty].filter(Boolean).join(" · "),
      size: "form",
      body,
      footer: el("p", { class: "panel-note", text: t("health.notDiagnosis") })
    });
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
