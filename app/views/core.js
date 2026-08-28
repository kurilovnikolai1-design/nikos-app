/* Command Center, Inbox, Tasks, Projects. */

import { el, panel, panelHeader, metricCard, emptyState, toast, openDialog } from "../ui.js?v=20260827-171447";
import { t, getLocale, formatDate, relativeDays, countOf, plural, PLURALS, categoryLabel,
         statusLabel, priorityLabel, formatNumber, typeLabel } from "../i18n.js?v=20260827-171447";
import { formatMoney } from "../money.js?v=20260827-171447";
import { netWorth, periodRange, sportSummary, inRange } from "../finance.js?v=20260827-171447";
import { buildAttention } from "../attention.js?v=20260827-171447";
import { recordList, recordRow, addButton, pageHeading, refresh, sparkline } from "../render.js?v=20260827-171447";
import { openRecordForm } from "../form.js?v=20260827-171447";
import { navigate } from "../router.js?v=20260827-171447";
import * as store from "../store.js?v=20260827-171447";
import { projectsWithMoney, projectTotals, PROJECT_MONEY_NOTE } from "../project-money.js?v=20260827-171447";
import { nextTaskFrom, isRepeating, frequencyLabel } from "../recurrence.js?v=20260827-171447";
import * as records from "../records.js?v=20260827-171447";

const ru = () => getLocale() === "ru";
const base = () => store.getSettings().baseCurrency || "RUB";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return t("cmd.night");
  if (hour < 12) return t("cmd.morning");
  if (hour < 18) return t("cmd.afternoon");
  return t("cmd.evening");
};

export const todayTasks = () => store.recordsOfType("task")
  .filter((task) => task.status !== "done" && task.date && task.date <= records.today())
  .sort((a, b) => (a.date === b.date ? String(a.dueTime).localeCompare(String(b.dueTime)) : String(a.date).localeCompare(String(b.date))));

/* ---------- Command Center ---------- */

export function commandView() {
  const all = store.liveRecords();
  const attention = buildAttention(store.getState(), { rates: store.getRates(), settings: store.getSettings() });
  const worth = netWorth(all, base(), store.getRates());
  const due = todayTasks();
  const projects = store.recordsOfType("project").filter((item) => ["active", "planned", "waiting"].includes(item.status));
  const sport = sportSummary(all, periodRange("month", 0));

  const page = document.createDocumentFragment();

  page.append(pageHeading(greeting(), t("cmd.lede"),
    el("button", { class: "primary-button", type: "button", onclick: () => openQuickAdd() },
      [el("span", { text: "＋" }), ` ${t("app.quickAdd")}`]),
    formatDate(new Date(), "weekday").toUpperCase()));

  page.append(el("div", { class: "signal-strip" }, [
    el("div", { class: "signal-copy" }, [
      el("span", { class: "pulse-ring", "aria-hidden": "true" }),
      el("span", { text: t("cmd.liveSignal") }),
      el("strong", { text: attention.length
        ? attentionSentence(attention.length)
        : t("cmd.attentionEmpty") })
    ]),
    attention.length ? el("button", {
      class: "text-button", type: "button", text: `${t("cmd.openAttention")} →`,
      onclick: () => document.getElementById("attentionList")?.scrollIntoView({ behavior: "smooth", block: "center" })
    }) : null
  ]));

  const grid = el("div", { class: "dashboard-grid" });

  /* Today */
  grid.append(panel("today-panel",
    panelHeader(t("cmd.today"), t("cmd.keepMoving"),
      el("button", { class: "small-button", type: "button", text: "•••", "aria-label": t("view.tasks"),
                     onclick: () => navigate("tasks") })),
    due.length
      ? el("div", { class: "task-list" }, due.slice(0, 6).map(taskLine))
      : emptyState(t("cmd.noTasksToday"), t("cmd.addFirstTask"), () => openRecordForm("task", null, { onSaved: refresh })),
    el("div", { class: "panel-footer" }, [
      el("span", { text: due.length ? countOf(due.length, PLURALS.task) : "" }),
      el("button", { class: "text-button", type: "button", text: `${t("cmd.allTasks")} →`, onclick: () => navigate("tasks") })
    ])));

  /* Attention */
  grid.append(panel("attention-panel",
    panelHeader(t("cmd.attention"), t("cmd.attentionTitle"),
      el("span", { class: "attention-count", text: String(attention.length).padStart(2, "0") })),
    el("div", { class: "attention-list", id: "attentionList" },
      attention.length
        ? attention.slice(0, 8).map(attentionRow)
        : [emptyState(t("cmd.attentionEmpty"))]),
    el("div", { class: "panel-footer" }, [el("span", { class: "muted-text", text: t("cmd.attentionRanked") })])));

  /* Capital */
  grid.append(panel("capital-panel",
    panelHeader(t("cmd.capitalSnapshot"), t("cmd.netWorth"),
      el("span", { class: "as-of", text: worth.hasAnything ? `${formatDate(new Date(), "short")} · ${base()}` : "" })),
    el("div", { class: "net-worth-line" }, [
      el("strong", { text: worth.hasAnything ? formatMoney(worth.totalMinor, base(), getLocale()) : "—" }),
      el("span", { class: "pending-badge", text: worth.hasAnything ? t("cmd.fromConfirmed") : t("cmd.addFirstAccount") })
    ]),
    el("p", { class: "privacy-subtitle", text: worth.hasAnything
      ? (ru() ? "Считаются только подтверждённые записи." : "Only confirmed records are counted.")
      : t("cmd.noBalances") }),
    worth.hasAnything ? allocation(worth) : null,
    el("div", { class: "panel-footer" }, [
      el("span", { class: "confidence-label" }, [
        el("span", { class: `status-dot ${worth.confidence >= 80 ? "green" : "amber-dot"}` }),
        worth.confidence === null ? (ru() ? "Ожидаются данные" : "Awaiting data") : `${t("money.confidence")}: ${worth.confidence}%`
      ]),
      el("button", { class: "text-button", type: "button", text: `${t("cmd.openCapital")} →`, onclick: () => navigate("capital") })
    ])));

  /* Projects */
  grid.append(panel("projects-panel",
    panelHeader(ru() ? "ПРОЕКТЫ" : "PROJECTS", t("cmd.moving"),
      el("button", { class: "small-button", type: "button", text: "•••", "aria-label": t("view.projects"),
                     onclick: () => navigate("projects") })),
    projects.length
      ? el("div", { class: "project-list" }, projects.slice(0, 4).map(projectLine))
      : emptyState(t("cmd.projectsEmpty"), typeLabel("project"), () => openRecordForm("project", null, { onSaved: refresh })),
    el("div", { class: "panel-footer" }, [
      el("span", { class: "muted-text", text: projects.length ? countOf(projects.length, PLURALS.record) : "" }),
      el("button", { class: "text-button", type: "button", text: `${t("cmd.allProjects")} →`, onclick: () => navigate("projects") })
    ])));

  /* Sport & shape */
  grid.append(panel("sport-panel",
    panelHeader(t("cmd.sport"), t("cmd.sportTitle"),
      el("button", { class: "small-button", type: "button", text: "•••", "aria-label": t("view.health"),
                     onclick: () => navigate("health") })),
    sport.count || sport.weight.latest !== null
      ? el("div", { class: "sport-summary" }, [
          el("div", { class: "sport-stats" }, [
            stat(String(sport.count), t("health.workouts")),
            stat(formatNumber(sport.hours, 1), t("health.hours")),
            sport.distance ? stat(`${formatNumber(sport.distance, 1)} ${ru() ? "км" : "km"}`, t("health.distance")) : null,
            sport.streak ? stat(String(sport.streak), `${t("health.streak")}: ${plural(sport.streak, PLURALS.day)}`) : null
          ].filter(Boolean)),
          sport.weight.series.length > 1 ? el("div", { class: "sport-trend" }, [
            el("span", { class: "panel-kicker", text: t("health.weightTrend") }),
            sparkline(sport.weight.series.slice(-30), { tone: "cyan" }),
            el("b", { text: `${formatNumber(sport.weight.latest, 1)} ${ru() ? "кг" : "kg"}${
              sport.weight.change !== null ? ` (${sport.weight.change > 0 ? "+" : ""}${formatNumber(sport.weight.change, 1)})` : ""}` })
          ]) : null
        ])
      : emptyState(t("cmd.sportEmpty"), t("health.logWorkout"), () => openRecordForm("workout", null, { onSaved: refresh })),
    el("div", { class: "panel-footer" }, [
      el("span", { class: "muted-text", text: sport.count ? countOf(sport.count, PLURALS.workout) : "" }),
      el("button", { class: "text-button", type: "button", text: `${t("cmd.openHealth")} →`, onclick: () => navigate("health") })
    ])));

  /* Recent activity */
  const recent = [...all].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6);
  grid.append(panel("activity-panel",
    panelHeader(t("cmd.recent"), t("cmd.recentTitle")),
    recent.length
      ? el("div", { class: "activity-list" }, recent.map((record) => el("button", {
          class: "activity-row", type: "button",
          onclick: () => openRecordForm(record.type, record, { onSaved: refresh })
        }, [
          el("span", { class: "activity-dot", "aria-hidden": "true" }),
          el("span", {}, [
            el("strong", { text: record.name }),
            el("small", { text: `${typeLabel(record.type)} · ${relativeDays(record.updatedAt)}` })
          ])
        ])))
      : emptyState(t("cmd.recentEmpty"))));

  page.append(grid);
  return page;

  function stat(value, label) {
    return el("div", { class: "sport-stat" }, [el("strong", { text: value }), el("small", { text: label })]);
  }

  function allocation(result) {
    const parts = [
      { key: "liquid", label: t("money.liquid"), value: result.buckets.liquid, tone: "cyan" },
      { key: "invested", label: t("money.invested"), value: result.buckets.invested + result.buckets.crypto, tone: "violet-dot" },
      { key: "property", label: t("money.property"), value: result.buckets.property, tone: "amber" }
    ];
    const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0) || 1;
    return el("div", { class: "allocation" }, [
      el("div", { class: "allocation-bar" }, parts.map((part) =>
        el("i", { class: `alloc-seg ${part.tone}`, style: `width:${Math.max(0, (part.value / total) * 100)}%`, title: part.label }))),
      el("div", { class: "allocation-legend" }, parts.map((part) =>
        el("div", {}, [
          el("i", { class: `legend-dot ${part.tone}` }),
          el("span", { text: part.label }),
          el("b", { text: formatMoney(part.value, base(), getLocale()) })
        ])))
    ]);
  }
}

function attentionSentence(count) {
  const forms = PLURALS.item;
  if (!ru()) return `${count} ${count === 1 ? "item needs" : "items need"} your attention`;
  const rules = new Intl.PluralRules("ru-RU").select(count);
  return `${countOf(count, forms)} ${rules === "one" ? "требует" : "требуют"} внимания`;
}

function attentionRow(item) {
  return el("button", {
    class: `attention-row ${item.severity}`, type: "button",
    onclick: async () => {
      if (item.action === "confirm-pending") { navigate("capital"); return; }
      if (item.action === "refresh-rates" || item.action === "export") { navigate("settings"); return; }
      const record = item.recordId ? store.byId(item.recordId) : null;
      if (record) openRecordForm(record.type, record, { onSaved: refresh });
      else navigate(item.view || "command");
    }
  }, [
    el("span", { class: "attention-marker", text: item.marker }),
    el("span", {}, [el("strong", { text: item.title }), el("small", { text: item.detail })]),
    el("span", { class: "attention-arrow", text: "↗" })
  ]);
}

function taskLine(task) {
  const row = el("label", { class: `task-row${task.priority === "high" ? " priority-high" : ""}` });
  const box = el("input", {
    type: "checkbox", "aria-label": `${t("app.confirm")}: ${task.name}`,
    onchange: async () => {
      const result = await records.patchRecord(task.id, { status: "done" }, "record-updated");
      if (!result.ok) return;

      /* A repeating task leaves the completed one alone and creates the next
         beside it, so "когда я делал это в прошлый раз" stays answerable. */
      const follow = nextTaskFrom(task, { blank: records.blankRecord });
      if (follow) {
        const saved = await records.saveRecord(follow);
        toast(saved.ok
          ? (ru() ? `Готово. Следующая — ${formatDate(follow.date, "medium")}` : `Done. Next on ${formatDate(follow.date, "medium")}`)
          : (ru() ? "Готово, но повтор создать не удалось" : "Done, but the repeat could not be created"),
          { tone: saved.ok ? "success" : "warn" });
      } else {
        toast(ru() ? "Задача выполнена" : "Task done", { tone: "success" });
      }
      refresh();
    }
  });
  row.append(box, el("span", { class: "checkmark", "aria-hidden": "true" }),
    el("span", { class: "task-text" }, [
      el("strong", { text: task.name }),
      el("small", { text: [categoryLabel("task", task.category),
        isRepeating(task) ? frequencyLabel(task.frequency, getLocale()).toLowerCase() : null,
        task.date && task.date < records.today() ? relativeDays(task.date) : null].filter(Boolean).join(" · ") })
    ]),
    el("span", { class: "task-time", text: task.dueTime || (task.date === records.today() ? t("app.today") : relativeDays(task.date)) }));
  return row;
}

function projectLine(project) {
  const percent = Number.isFinite(Number(project.progress)) ? Number(project.progress) : null;
  return el("button", {
    class: "project-row", type: "button",
    onclick: () => openRecordForm("project", project, { onSaved: refresh })
  }, [
    el("span", { class: "project-avatar", text: (project.name || "?").trim().charAt(0).toUpperCase() }),
    el("span", { class: "project-main" }, [
      el("strong", { text: project.name }),
      el("small", { text: `${categoryLabel("project", project.category)} · ${statusLabel(project.status)}` })
    ]),
    percent !== null ? el("span", { class: "project-progress" }, [
      el("i", { style: `width:${Math.max(0, Math.min(100, percent))}%` }),
      el("b", { text: `${percent}%` })
    ]) : null
  ]);
}

/* ---------- Quick Add ---------- */

/* One keystroke away from the thing an owner actually does most: log a spend,
   add a task, log a workout — not "write a note and sort it out later". */
export function openQuickAdd() {
  const choices = ["expense", "task", "income", "workout", "measurement", "note"];
  const dialog = openDialog({
    title: t("app.quickAdd"),
    subtitle: ru() ? "Что записываем?" : "What are we logging?",
    size: "narrow",
    body: el("div", { class: "quick-grid" }, choices.map((type) =>
      el("button", {
        class: "quick-tile", type: "button",
        onclick: () => { dialog.close(); openRecordForm(type, null, { onSaved: refresh }); }
      }, [
        el("span", { class: "quick-icon", text: iconFor(type) }),
        el("span", { text: typeLabel(type) })
      ])))
  });
  return dialog;
}

const iconFor = (type) => ({ expense: "↓", income: "↑", task: "✓", workout: "⚡", measurement: "◔", note: "✦" }[type] || "◈");

/* ---------- Inbox ---------- */

export function inboxView() {
  const notes = store.recordsOfType("note");
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.inbox"),
    ru() ? "Сначала запишите, разберётесь потом." : "Capture first, sort it out later.",
    addButton("note", typeLabel("note"), refresh)));

  const input = el("textarea", {
    class: "form-control capture-input", rows: "3",
    placeholder: ru() ? "Например: уточнить у подрядчика смету в пятницу" : "e.g. Check the estimate with the contractor on Friday"
  });

  page.append(panel("capture-panel",
    panelHeader(ru() ? "ЗАХВАТ" : "CAPTURE", ru() ? "Превратите мысль во что-то полезное" : "Turn a thought into something useful"),
    input,
    el("div", { class: "capture-actions" }, [
      el("span", { class: "muted-text", text: ru() ? "Сохранится как заметка — потом превратите в задачу или расход." : "Saved as a note — convert it to a task or an expense later." }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: save })
    ])));

  page.append(panel("records-panel",
    panelHeader(ru() ? "ЗАМЕТКИ" : "NOTES", `${countOf(notes.length, PLURALS.proposal)}`),
    recordList("inbox-notes", notes, {
      empty: ru() ? "Пока пусто. Запишите первую мысль." : "Nothing captured yet.",
      addType: "note"
    })));

  return page;

  async function save() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const draft = { ...records.blankRecord("note"), name: text.slice(0, 120), details: text };
    const saved = await records.saveRecord(draft);
    if (!saved.ok) {
      toast(saved.unsafe ? t("sec.seedBlocked") : t("sec.storageFull"), { tone: "danger" });
      return;
    }
    input.value = "";
    toast(t("rec.saved"), { tone: "success" });
    refresh();
  }
}

/* ---------- Tasks ---------- */

const taskState = { layout: "list", period: "all", priority: "all", category: "all", offset: 0, day: null };

export function tasksView() {
  const all = store.recordsOfType("task");
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.tasks"),
    ru() ? "Что нужно сделать и когда." : "What needs doing, and when.",
    addButton("task", typeLabel("task"), refresh)));

  const counts = {
    all: all.length,
    today: all.filter((task) => task.date === records.today() && task.status !== "done").length,
    waiting: all.filter((task) => task.status === "waiting").length,
    overdue: all.filter((task) => task.status !== "done" && task.date && task.date < records.today()).length,
    done: all.filter((task) => task.status === "done").length
  };

  page.append(el("div", { class: "toolbar" }, [
    el("div", { class: "segmented" }, [
      segButton("list", `☷ ${ru() ? "Список" : "List"}`),
      segButton("calendar", `▦ ${ru() ? "Календарь" : "Calendar"}`)
    ]),
    el("div", { class: "toolbar-filters" }, [
      selectFilter("period", [
        { value: "all", label: t("app.all") },
        { value: "today", label: t("app.today") },
        { value: "week", label: t("app.week") },
        { value: "month", label: t("app.month") },
        { value: "overdue", label: statusLabel("overdue") },
        { value: "waiting", label: statusLabel("waiting") },
        { value: "done", label: statusLabel("done") }
      ]),
      selectFilter("priority", [{ value: "all", label: t("form.priority") },
        ...["high", "medium", "low"].map((key) => ({ value: key, label: priorityLabel(key) }))]),
      selectFilter("category", [{ value: "all", label: t("form.category") },
        ...(store.recordsOfType("task").length
          ? [...new Set(all.map((task) => task.category))].map((key) => ({ value: key, label: categoryLabel("task", key) }))
          : [])])
    ])
  ]));

  page.append(el("div", { class: "filter-row" }, [
    countChip("all", t("app.all"), counts.all),
    countChip("today", t("app.today"), counts.today),
    countChip("overdue", statusLabel("overdue"), counts.overdue),
    countChip("waiting", statusLabel("waiting"), counts.waiting),
    countChip("done", statusLabel("done"), counts.done)
  ]));

  if (taskState.day) {
    page.append(el("div", { class: "active-filter" }, [
      el("span", { text: `${ru() ? "Показан день" : "Showing"}: ${formatDate(taskState.day, "long")}` }),
      el("button", { class: "text-button", type: "button", text: ru() ? "Показать все дни ✕" : "Show all days ✕",
                     onclick: () => { taskState.day = null; refresh(); } })
    ]));
  }

  const filtered = filterTasks(all);

  if (taskState.layout === "calendar") page.append(taskCalendar(filtered));
  else page.append(panel("records-panel",
    panelHeader(ru() ? "ЗАДАЧИ" : "TASKS", countOf(filtered.length, PLURALS.task)),
    recordList(`tasks-${taskState.period}-${taskState.priority}-${taskState.category}`, sortTasks(filtered), {
      empty: counts.all ? (ru() ? "Под этот фильтр ничего не подходит." : "Nothing matches this filter.")
                        : (ru() ? "Задач пока нет." : "No tasks yet."),
      addType: "task"
    })));

  return page;

  function segButton(value, label) {
    return el("button", {
      class: `seg-button${taskState.layout === value ? " selected" : ""}`, type: "button", text: label,
      onclick: () => { taskState.layout = value; if (value === "calendar") taskState.day = null; refresh(); }
    });
  }

  function countChip(value, label, count) {
    return el("button", {
      class: `filter-chip${taskState.period === value ? " selected" : ""}`, type: "button",
      onclick: () => { taskState.period = value; taskState.day = null; refresh(); }
    }, [label, el("b", { text: String(count) })]);
  }

  function selectFilter(key, options) {
    return el("select", {
      class: "form-control compact", "aria-label": options[0].label,
      onchange: (event) => { taskState[key] = event.target.value; refresh(); }
    }, options.map((item) => el("option", { value: item.value, selected: taskState[key] === item.value ? "selected" : null, text: item.label })));
  }
}

function filterTasks(all) {
  const now = records.today();
  return all.filter((task) => {
    if (taskState.day && task.date !== taskState.day) return false;
    if (taskState.priority !== "all" && task.priority !== taskState.priority) return false;
    if (taskState.category !== "all" && task.category !== taskState.category) return false;

    switch (taskState.period) {
      case "today": return task.date === now && task.status !== "done";
      case "overdue": return task.status !== "done" && task.date && task.date < now;
      case "waiting": return task.status === "waiting";
      case "done": return task.status === "done";
      case "week": return task.date && inRange(task.date, periodRange("week", 0));
      case "month": return task.date && inRange(task.date, periodRange("month", 0));
      default: return true;
    }
  });
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const sortTasks = (list) => [...list].sort((a, b) => {
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  const dateA = a.date || "9999-99-99";
  const dateB = b.date || "9999-99-99";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
});

function taskCalendar(tasks) {
  const today = new Date();
  const anchor = new Date(today.getFullYear(), today.getMonth() + taskState.offset, 1);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);

  const dayNames = ru() ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const byDate = new Map();
  for (const task of tasks) {
    if (!task.date) continue;
    if (!byDate.has(task.date)) byDate.set(task.date, []);
    byDate.get(task.date).push(task);
  }

  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = iso(day);
    const items = byDate.get(key) || [];
    const classes = ["task-day"];
    if (key === records.today()) classes.push("today");
    if (day.getMonth() !== anchor.getMonth()) classes.push("outside");

    const addLabel = ru()
      ? `Добавить задачу на ${formatDate(key, "long")}`
      : `Add a task on ${formatDate(key, "long")}`;

    return el("div", { class: classes.join(" ") }, [
      el("div", { class: "task-day-head" }, [
        el("span", { text: dayNames[index % 7] }),
        el("b", { text: String(day.getDate()) })
      ]),
      ...items.slice(0, 4).map((task) => el("button", {
        class: `calendar-task ${task.priority}${task.status === "done" ? " done" : ""}`, type: "button",
        dataset: { recordId: task.id },
        onclick: () => openRecordForm("task", task, { onSaved: refresh })
      }, [el("strong", { text: task.name })])),
      items.length > 4 ? el("button", {
        class: "task-day-more", type: "button",
        text: `${ru() ? "ещё" : "more"} +${items.length - 4}`,
        onclick: () => { taskState.layout = "list"; taskState.period = "all"; taskState.day = key; refresh(); }
      }) : null,
      /* The rest of the cell is a target of its own: tapping an empty day
         opens a new task already dated to that day, which is the thing you
         actually want a calendar for. */
      el("button", {
        class: "task-day-add", type: "button", "aria-label": addLabel, title: addLabel,
        onclick: () => openRecordForm("task", null, { presets: { date: key }, onSaved: refresh })
      }, [el("span", { class: "task-day-plus", "aria-hidden": "true", text: "＋" })])
    ]);
  });

  const unscheduled = tasks.filter((task) => !task.date);

  return panel("task-calendar-panel",
    el("div", { class: "calendar-heading" }, [
      el("div", {}, [
        el("span", { class: "panel-kicker", text: ru() ? "КАЛЕНДАРЬ" : "CALENDAR" }),
        el("h2", { text: new Intl.DateTimeFormat(ru() ? "ru-RU" : "en-US", { month: "long", year: "numeric" }).format(anchor) })
      ]),
      el("div", { class: "calendar-controls" }, [
        el("button", { class: "small-button", type: "button", "aria-label": ru() ? "Предыдущий месяц" : "Previous month",
                       text: "←", onclick: () => { taskState.offset -= 1; refresh(); } }),
        el("button", { class: "small-button", type: "button", text: t("app.today"),
                       onclick: () => { taskState.offset = 0; refresh(); } }),
        el("button", { class: "small-button", type: "button", "aria-label": ru() ? "Следующий месяц" : "Next month",
                       text: "→", onclick: () => { taskState.offset += 1; refresh(); } })
      ])
    ]),
    el("div", { class: "task-calendar-grid month" }, cells),
    unscheduled.length
      ? el("div", { class: "unscheduled" }, [
          el("span", { class: "panel-kicker", text: ru() ? "БЕЗ ДАТЫ" : "NO DATE" }),
          ...unscheduled.map((task) => recordRow(task, { compact: true }))
        ])
      : null);
}

/* ---------- Projects ---------- */

export function projectsView() {
  const projects = store.recordsOfType("project");
  const active = projects.filter((item) => ["active", "planned", "waiting"].includes(item.status));
  const closed = projects.filter((item) => ["done", "closed"].includes(item.status));

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.projects"),
    ru() ? "Результат, ответственный и следующий шаг в одном месте." : "Outcome, owner and next step in one place.",
    addButton("project", typeLabel("project"), refresh)));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "В РАБОТЕ" : "ACTIVE", value: String(active.length) }),
    metricCard({ kicker: ru() ? "ЗАВЕРШЕНО" : "CLOSED", value: String(closed.length) }),
    metricCard({ kicker: ru() ? "СРЕДНЯЯ ГОТОВНОСТЬ" : "AVG PROGRESS",
                 value: active.length
                   ? `${Math.round(active.reduce((sum, item) => sum + (Number(item.progress) || 0), 0) / active.length)}%`
                   : "—" })
  ]));

  /* Money attached to projects, when there is any. A project screen without
     it answers only how far along something is, never whether it pays. */
  const withMoney = projectsWithMoney(store.liveRecords(), base(), store.getRates());
  if (withMoney.length) {
    const totals = projectTotals(withMoney);
    const asMoney = (minor) => formatMoney(minor, base(), getLocale());
    const signed = (minor) => `${minor > 0 ? "+" : ""}${asMoney(minor)}`;

    page.append(panel("records-panel project-money-panel",
      panelHeader(ru() ? "ДЕНЬГИ ПО ПРОЕКТАМ" : "MONEY BY PROJECT",
        ru() ? `Итого ${signed(totals.netMinor)}` : `Total ${signed(totals.netMinor)}`),

      el("div", { class: "project-money-list" }, withMoney.map((entry) => el("div", {
        class: `project-money-row ${entry.state}`
      }, [
        el("div", { class: "project-money-head" }, [
          el("strong", { text: entry.project.name }),
          el("b", { text: signed(entry.netMinor) })
        ]),
        el("small", { text: ru()
          ? `Доход ${asMoney(entry.incomeMinor)} · расход ${asMoney(entry.expenseMinor)}${entry.returnPercent === null ? "" : ` · ${entry.returnPercent > 0 ? "+" : ""}${entry.returnPercent.toFixed(0)}% к вложенному`}`
          : `In ${asMoney(entry.incomeMinor)} · out ${asMoney(entry.expenseMinor)}${entry.returnPercent === null ? "" : ` · ${entry.returnPercent.toFixed(0)}% return`}` }),
        entry.skipped
          ? el("small", { class: "warn", text: ru()
              ? `Не посчитано записей: ${entry.skipped}.`
              : `${entry.skipped} records could not be counted.` })
          : null
      ]))),

      el("p", { class: "panel-note", text: ru() ? PROJECT_MONEY_NOTE.ru : PROJECT_MONEY_NOTE.en })));
  }

  page.append(panel("records-panel",
    panelHeader(ru() ? "ПРОЕКТЫ" : "PROJECTS", ru() ? "В работе" : "In motion"),
    recordList("projects-active", active, {
      empty: ru() ? "Активных проектов нет." : "No active projects.",
      addType: "project"
    })));

  if (closed.length) {
    page.append(panel("records-panel",
      panelHeader(ru() ? "АРХИВ" : "ARCHIVE", ru() ? "Завершённые" : "Completed"),
      recordList("projects-closed", closed, { empty: "", compact: true })));
  }

  return page;
}
