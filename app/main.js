/* Boot, shell and routing. */

import { el, mount, toast, openDialog, confirmDialog } from "./ui.js?v=20260827-142201";
import { initLocale, setLocale, getLocale, onLocaleChange, t, typeLabel, categoryLabel,
         statusLabel, formatDate, countOf, PLURALS } from "./i18n.js?v=20260827-142201";
import { initRouter, navigate, onNavigate, currentView, VIEWS } from "./router.js?v=20260827-142201";
import { assertSchemaIsSound, TYPES } from "./schema.js?v=20260827-142201";
import { buildAttention } from "./attention.js?v=20260827-142201";
import { refresh, recordRow } from "./render.js?v=20260827-142201";
import { openRecordForm, ensureCoinList } from "./form.js?v=20260827-142201";
import { scheduleRateRefresh } from "./main-rates.js?v=20260827-142201";
import { selfTest as safetySelfTest } from "./safety.js?v=20260827-142201";
import * as lock from "./lock.js?v=20260827-142201";
import * as persist from "./persist.js?v=20260827-142201";
import * as store from "./store.js?v=20260827-142201";
import * as records from "./records.js?v=20260827-142201";
import * as cloud from "./cloud.js?v=20260827-142201";
import * as notify from "./notify.js?v=20260827-142201";
import * as attachments from "./attachments.js?v=20260827-142201";
import * as whoop from "./whoop.js?v=20260827-142201";

import { commandView, inboxView, tasksView, projectsView, openQuickAdd } from "./views/core.js?v=20260827-142201";
import { capitalView, debtsView, cashflowView, investmentsView, cryptoView } from "./views/money.js?v=20260827-142201";
import { assetsView, healthView, labsView, documentsView, peopleView, decisionsView, timelineView } from "./views/life.js?v=20260827-142201";
import { settingsView } from "./views/settings.js?v=20260827-142201";

const ru = () => getLocale() === "ru";

const RENDERERS = {
  command: commandView, inbox: inboxView, tasks: tasksView, projects: projectsView,
  capital: capitalView, debts: debtsView, cashflow: cashflowView,
  investments: investmentsView, crypto: cryptoView, assets: assetsView,
  health: healthView, labs: labsView, documents: documentsView, people: peopleView,
  decisions: decisionsView, timeline: timelineView, settings: settingsView
};

const NAV = [
  { group: "nav.overview", items: [
    { view: "command", icon: "⌂" }, { view: "inbox", icon: "✦" },
    { view: "tasks", icon: "✓" }, { view: "projects", icon: "↗" }] },
  { group: "nav.capital", items: [
    { view: "capital", icon: "◈" }, { view: "debts", icon: "↔" }, { view: "cashflow", icon: "≈" },
    { view: "investments", icon: "◇" }, { view: "crypto", icon: "₿" }] },
  { group: "nav.life", items: [
    { view: "assets", icon: "□" }, { view: "health", icon: "♡" }, { view: "labs", icon: "⚗" }, { view: "documents", icon: "▱" },
    { view: "people", icon: "◎" }, { view: "decisions", icon: "◆" }, { view: "timeline", icon: "◷" }] }
];

/* The five sections a phone actually needs within thumb reach. */
const MOBILE_TABS = [
  { view: "command", icon: "⌂" }, { view: "tasks", icon: "✓" },
  { view: "cashflow", icon: "≈" }, { view: "health", icon: "♡" }, { view: "capital", icon: "◈" }
];

const dom = {};

/* ---------- Shell ---------- */

function buildShell() {
  const root = document.getElementById("app");

  dom.navHost = el("nav", { class: "primary-nav", "aria-label": ru() ? "Основная навигация" : "Primary navigation" });
  dom.sidebar = el("aside", { class: "sidebar", id: "sidebar" }, [
    el("div", { class: "brand-lockup" }, [
      el("div", { class: "brand-mark", "aria-hidden": "true" }, [el("span"), el("span"), el("span")]),
      el("div", {}, [
        el("div", { class: "brand-name", text: "Nik'Os" }),
        el("div", { class: "brand-caption", text: t("app.controlRoom") })
      ])
    ]),
    dom.navHost,
    el("div", { class: "sidebar-footer" }, [
      el("button", { class: "nav-item muted", type: "button", onclick: () => navigate("settings") },
        [el("span", { class: "nav-icon", text: "⚙" }), el("span", { text: t("view.settings") })]),
      dom.privacyNote = el("div", { class: "privacy-note" }, [
        el("span", { class: "status-dot green", "aria-hidden": "true" }),
        el("span", { text: t("app.privateByDefault") })
      ])
    ])
  ]);

  dom.scrim = el("div", { class: "sidebar-scrim", hidden: true, onclick: () => toggleSidebar(false) });

  dom.breadcrumb = el("strong", { id: "breadcrumbLabel", text: t("view.command") });
  dom.attentionDot = el("i", { class: "notification-dot", hidden: true });

  dom.topbar = el("header", { class: "topbar" }, [
    el("button", {
      class: "mobile-menu icon-button", type: "button", "aria-label": t("app.openNav"),
      text: "☰", onclick: () => toggleSidebar()
    }),
    el("div", { class: "breadcrumbs" }, [dom.breadcrumb]),
    el("div", { class: "topbar-actions" }, [
      el("button", { class: "search-trigger", type: "button", onclick: openSearch }, [
        el("span", { class: "search-glyph", "aria-hidden": "true", text: "⌕" }),
        el("span", { class: "search-label", text: t("app.search") }),
        el("kbd", { text: "⌘K" })
      ]),
      dom.themeButton = el("button", { class: "icon-button", type: "button", onclick: toggleTheme }),
      dom.langButton = el("button", { class: "icon-button lang-toggle", type: "button", onclick: toggleLocale }),
      el("button", {
        class: "icon-button notification-button", type: "button", "aria-label": t("app.notifications"),
        onclick: () => { navigate("command"); setTimeout(() => document.getElementById("attentionList")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); }
      }, [el("span", { "aria-hidden": "true", text: "◌" }), dom.attentionDot])
    ])
  ]);

  dom.pageHost = el("div", { class: "page-wrap", id: "pageHost" });
  dom.main = el("main", { class: "main-content" }, [dom.topbar, dom.pageHost]);

  dom.mobileNav = el("nav", { class: "mobile-tabs", "aria-label": ru() ? "Разделы" : "Sections" });
  dom.fab = el("button", {
    class: "fab", type: "button", "aria-label": t("app.quickAdd"), text: "＋", onclick: () => openQuickAdd()
  });

  mount(root, el("div", { class: "app-shell" }, [dom.sidebar, dom.scrim, dom.main]), dom.mobileNav, dom.fab);

  renderNav();
  renderMobileTabs();
  updateThemeButton();
  updateLangButton();
}

function renderNav() {
  const attention = attentionByView();
  mount(dom.navHost, ...NAV.flatMap((section) => [
    el("div", { class: "nav-label", text: t(section.group) }),
    ...section.items.map((item) => {
      const count = counterFor(item.view, attention);
      return el("button", {
        class: `nav-item${currentView() === item.view ? " active" : ""}`,
        type: "button", "aria-current": currentView() === item.view ? "page" : null,
        onclick: () => { navigate(item.view); toggleSidebar(false); }
      }, [
        el("span", { class: "nav-icon", "aria-hidden": "true", text: item.icon }),
        el("span", { class: "nav-text", text: t(`view.${item.view}`) }),
        count ? el("span", { class: `nav-count${count.tone ? ` ${count.tone}` : ""}`, text: String(count.value) }) : null
      ]);
    })
  ]));
}

function renderMobileTabs() {
  const attention = attentionByView();
  mount(dom.mobileNav, ...MOBILE_TABS.map((item) => {
    const count = counterFor(item.view, attention);
    return el("button", {
      class: `mobile-tab${currentView() === item.view ? " active" : ""}`,
      type: "button", "aria-current": currentView() === item.view ? "page" : null,
      onclick: () => navigate(item.view)
    }, [
      el("span", { class: "mobile-tab-icon", "aria-hidden": "true", text: item.icon }),
      el("span", { class: "mobile-tab-label", text: t(`tab.${item.view}`) }),
      count?.tone === "critical" ? el("i", { class: "tab-dot" }) : null
    ]);
  }));
}

/* Counters come from the data, never from a number typed into the markup. */
function counterFor(view, attention) {
  const urgent = attention.get(view);
  if (urgent?.critical) return { value: urgent.total, tone: "critical" };

  if (view === "tasks") {
    const open = store.recordsOfType("task").filter((task) => task.status !== "done").length;
    return open ? { value: open, tone: urgent ? "amber" : "" } : null;
  }
  if (view === "inbox") {
    const notes = store.recordsOfType("note").length;
    return notes ? { value: notes, tone: "violet" } : null;
  }
  return urgent ? { value: urgent.total, tone: "amber" } : null;
}

function attentionByView() {
  const items = buildAttention(store.getState(), { rates: store.getRates(), settings: store.getSettings() });
  const map = new Map();
  for (const item of items) {
    const entry = map.get(item.view) || { total: 0, critical: false };
    entry.total += 1;
    if (item.severity === "critical") entry.critical = true;
    map.set(item.view, entry);
  }
  dom.attentionDot.hidden = items.length === 0;
  return map;
}

/* The floating button sits over the content, so it steps out of the way while
   the owner is scrolling down and comes back the moment they scroll up. */
function watchScrollForFab() {
  let last = window.scrollY;
  window.addEventListener("scroll", () => {
    const current = window.scrollY;
    if (Math.abs(current - last) < 8) return;
    dom.fab?.classList.toggle("tucked", current > last && current > 120);
    last = current;
  }, { passive: true });
}

const toggleSidebar = (force = null) => {
  const open = force === null ? !dom.sidebar.classList.contains("open") : force;
  dom.sidebar.classList.toggle("open", open);
  dom.scrim.hidden = !open;
  document.body.classList.toggle("nav-open", open);
};

/* ---------- Theme & locale ---------- */

function applyTheme(theme) {
  document.body.dataset.theme = theme === "light" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f6f4ee" : "#0b0d0d");
  updateThemeButton();
}

function updateThemeButton() {
  if (!dom.themeButton) return;
  const light = document.body.dataset.theme === "light";
  dom.themeButton.textContent = light ? "☾" : "☼";
  dom.themeButton.setAttribute("aria-label", light ? t("app.toDark") : t("app.toLight"));
}

async function toggleTheme() {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  await store.updateSettings({ theme: next });
}

function updateLangButton() {
  if (!dom.langButton) return;
  dom.langButton.textContent = ru() ? "EN" : "RU";
  dom.langButton.setAttribute("aria-label", t("app.switchLang"));
}

function toggleLocale() {
  setLocale(ru() ? "en" : "ru");
}

/* ---------- Rendering ---------- */

let renderQueued = false;

export function render() {
  if (renderQueued) return;
  renderQueued = true;
  /* A timer, not requestAnimationFrame: rAF never fires while the tab is
     hidden or not compositing, which would leave the flag stuck and freeze
     every later update. A zero timeout still coalesces a burst of changes. */
  setTimeout(() => {
    renderQueued = false;
    if (store.isLocked()) { renderLockScreen(); return; }

    const view = currentView();
    dom.breadcrumb.textContent = t(`view.${view}`);
    document.title = `Nik'Os — ${t(`view.${view}`)}`;

    const renderer = RENDERERS[view] || RENDERERS.command;
    let content;
    try {
      content = renderer();
    } catch (error) {
      console.error("[nikos] view failed", error);
      content = el("div", { class: "inline-warning" }, [
        el("strong", { text: ru() ? "Не удалось отрисовать раздел" : "This section failed to render" }),
        el("p", { text: String(error?.message || error) })
      ]);
    }

    mount(dom.pageHost, content);
    dom.pageHost.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
    renderNav();
    renderMobileTabs();
  }, 0);
}

/* ---------- Lock screen ---------- */

function renderLockScreen() {
  const input = el("input", {
    class: "pin-input", type: "password", inputmode: "numeric", maxlength: "12",
    autocomplete: "current-password", "data-autofocus": "true",
    onkeydown: (event) => { if (event.key === "Enter") attempt(); }
  });
  const error = el("p", { class: "form-error" });

  mount(document.getElementById("app"), el("div", { class: "lock-screen" }, [
    el("div", { class: "lock-card" }, [
      el("div", { class: "brand-mark large", "aria-hidden": "true" }, [el("span"), el("span"), el("span")]),
      el("h1", { text: t("sec.lockTitle") }),
      el("p", { class: "lede", text: t("sec.enterPin") }),
      input,
      error,
      el("button", { class: "primary-button", type: "button", text: t("sec.unlock"), onclick: attempt })
    ])
  ]));
  requestAnimationFrame(() => input.focus());

  async function attempt() {
    const pin = input.value.trim();
    if (!pin) return;
    const result = await store.unlockWithPin(pin);
    if (!result.ok) {
      error.textContent = t("sec.wrongPin");
      input.value = "";
      input.focus();
      return;
    }
    buildShell();
    applyTheme(store.getSettings().theme);
    configureIdleLock();
    render();
  }
}

function configureIdleLock() {
  lock.configureIdleLock(store.getSettings().autoLockMinutes, () => {
    store.lockNow();
    toast(t("sec.lockTitle"));
  });
  lock.watchActivity();
}

/* ---------- Search ---------- */

function openSearch() {
  const input = el("input", {
    class: "search-input", type: "search", placeholder: t("app.searchPlaceholder"),
    "aria-label": t("app.search"), "data-autofocus": "true",
    oninput: () => update()
  });
  const results = el("div", { class: "search-results" });

  const dialog = openDialog({
    title: t("app.search"),
    size: "search",
    body: el("div", { class: "search-body" }, [input, results])
  });

  update();

  function update() {
    const query = input.value.trim().toLowerCase();

    const sectionHits = VIEWS
      .filter((view) => !query || t(`view.${view}`).toLowerCase().includes(query))
      .slice(0, query ? 4 : 0)
      .map((view) => el("button", { class: "search-result", type: "button", onclick: () => { dialog.close(); navigate(view); } }, [
        el("span", {}, [el("strong", { text: t(`view.${view}`) }), el("small", { text: ru() ? "Раздел" : "Section" })]),
        el("span", { text: "↗" })
      ]));

    const recordHits = (query
      ? store.liveRecords().filter((record) =>
          [record.name, record.details, record.counterparty, record.source, record.terms, record.coin]
            .filter(Boolean).join(" ").toLowerCase().includes(query))
      : [...store.liveRecords()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))))
      .slice(0, 30)
      .map((record) => el("button", {
        class: "search-result", type: "button",
        onclick: () => { dialog.close(); openRecordForm(record.type, record, { onSaved: refresh }); }
      }, [
        el("span", { class: "search-icon", text: TYPES[record.type]?.icon || "◈" }),
        el("span", {}, [
          el("strong", { text: record.name }),
          el("small", { text: `${typeLabel(record.type)} · ${categoryLabel(record.type, record.category)} · ${statusLabel(record.status)}` })
        ]),
        el("span", { text: "↗" })
      ]));

    const all = [...sectionHits, ...recordHits];
    mount(results, all.length ? all : [el("div", { class: "search-hint", text: query ? t("app.searchEmpty") : t("app.searchHint") })]);
  }
}

/* ---------- Boot ---------- */

async function boot() {
  initLocale();

  const problems = assertSchemaIsSound(VIEWS);
  if (problems.length) console.error("[nikos] schema problems", problems);
  const unsafe = safetySelfTest();
  if (unsafe.length) console.error("[nikos] safety self-test failed", unsafe);

  initRouter();

  const started = await store.init();

  if (started.status === "needs-pin") {
    renderLockScreen();
  } else {
    buildShell();
    applyTheme(store.getSettings().theme);
    ensureCoinList();
    watchScrollForFab();
    configureIdleLock();
    render();
    if (started.migrated) {
      toast(ru()
        ? `Записи из прошлой версии перенесены: ${store.allRecords().length}`
        : `${store.allRecords().length} records migrated from the previous version`, { tone: "success", duration: 6000 });
    }
    // Ask the browser to keep this origin; a phone short on space evicts
    // unpinned sites without asking, and that would mean losing records.
    void persist.requestPersistence();
    scheduleRateRefresh();
    void cloud.restore().then(() => whoop.handleReturn(() => render()));
  }

  store.subscribe((_state, reason) => {
    if (reason === "locked") { renderLockScreen(); return; }
    if (reason === "save-failed") {
      toast(t("sec.storageFull"), { tone: "danger", duration: 8000 });
      return;
    }
    /* Anything that changed records is owed to the cloud. Debounced inside,
       so a form submit costs one round trip rather than one per field. */
    if (reason !== "settings") cloud.schedulePush();
    render();
  });

  /* A phone backgrounds a tab without warning and may never resume it, so the
     debounce has to be cut short the moment the page stops being visible. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cloud.flushPush();
  });
  window.addEventListener("pagehide", () => cloud.flushPush());

  /* Reminders speak up when the app opens and when it returns to the
     foreground. Nothing is asked of the browser until the owner turns it on
     in settings — a permission prompt on first load gets refused, and a
     refusal is permanent. */
  /* Tells boot-guard.js the app is alive, so it stops waiting to show the
     "did not start" screen. */
  window.__nikosReady = true;

  notify.watch();

  /* No connection is a normal state for this app, not an error — records are
     written locally either way. What is worth saying is the consequence: the
     cloud copy is not being updated, so a lost phone would lose whatever was
     entered since. */
  const connectionBar = el("div", { class: "connection-bar", hidden: "hidden" });
  document.body.append(connectionBar);

  const showConnection = () => {
    const offline = !navigator.onLine;
    connectionBar.hidden = !offline;
    if (offline) {
      connectionBar.textContent = getLocale() === "ru"
        ? "Нет сети. Записи сохраняются на устройстве и уедут в облако, когда связь вернётся."
        : "Offline. Records are saved on this device and will upload when the connection returns.";
    }
  };
  window.addEventListener("online", () => { showConnection(); cloud.schedulePush(200); });
  window.addEventListener("offline", showConnection);
  showConnection();

  /* Running out of room is the one failure that loses records, so it is worth
     saying well before it happens rather than at the moment a save fails. */
  void persist.usage().then((used) => {
    if (!used || !Number.isFinite(used.percent)) return;
    if (used.percent < 85) return;
    toast(getLocale() === "ru"
      ? `Хранилище заполнено на ${used.percent}%. Освободите место или удалите крупные вложения — иначе новые записи перестанут сохраняться.`
      : `Storage is ${used.percent}% full. Free some space or remove large attachments, or new records will stop saving.`,
      { tone: "danger", duration: 12000 });
  });

  /* Deleting a record leaves its file behind. On a phone that accumulates
     silently, and the storage grant these records depend on is finite — so
     sweep once per start, after everything else has settled. */
  setTimeout(() => {
    void attachments.sweep(store.allRecords()).then((count) => {
      if (count) console.info(`Nik'Os: убрано осиротевших файлов — ${count}`);
    });
  }, 5000);

  onNavigate(() => render());
  onLocaleChange(() => { document.documentElement.lang = getLocale(); buildShell(); applyTheme(store.getSettings().theme); render(); });
  document.addEventListener("nikos:refresh", () => render());

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey
        && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      openQuickAdd();
    }
  });

  void records.purgeExpiredTrash();

  registerServiceWorker();
}

/* boot() is async, so by the time it gets here the load event has usually
   already fired — waiting for it meant the worker never registered and the
   app was never actually available offline. */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(location.protocol)) return;

  /* When a newer worker activates, the page may be running a mix of old and
     new modules. Reload once — guarded, so a worker that keeps re-activating
     can never put the app in a reload loop. */
  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "nikos-updated") reloadOnce();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (navigator.serviceWorker.controller) reloadOnce();
  });

  const run = () => navigator.serviceWorker.register("./sw.js")
    .then((registration) => { registration.update?.(); })
    .catch(() => { /* the offline shell is optional */ });
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

boot().catch((error) => {
  console.error("[nikos] boot failed", error);
  document.getElementById("app").innerHTML =
    `<div class="boot-error"><h1>Nik'Os не запустился</h1><p>${String(error?.message || error)}</p></div>`;
});
