/* Settings: security, backups, rates, sync, appearance, trash, diagnostics. */

import { el, panel, panelHeader, emptyState, toast, confirmDialog, openDialog } from "../ui.js?v=20260827-081615";
import { t, getLocale, setLocale, formatDate, countOf, PLURALS, typeLabel, categoryLabel } from "../i18n.js?v=20260827-081615";
import { CURRENCY_CODES, CURRENCIES, formatMoney } from "../money.js?v=20260827-081615";
import { refresh, pageHeading, recordList } from "../render.js?v=20260827-081615";
import { SOURCES, sourceLabel, isStale, COINS } from "../rates.js?v=20260827-081615";
import * as lock from "../lock.js?v=20260827-081615";
import * as persist from "../persist.js?v=20260827-081615";
import * as store from "../store.js?v=20260827-081615";
import * as records from "../records.js?v=20260827-081615";
import * as cloud from "../cloud.js?v=20260827-081615";
import { refreshRates } from "../main-rates.js?v=20260827-081615";
import { loadDemoData, clearDemoData, countDemo, isDemoRecord } from "../demo.js?v=20260827-081615";
import { whoopRow } from "../whoop.js?v=20260827-081615";

const ru = () => getLocale() === "ru";

export function settingsView() {
  const settings = store.getSettings();
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.settings"),
    ru() ? "Всё, что определяет, как Nik'Os себя ведёт." : "Everything that shapes how Nik'Os behaves."));

  page.append(securityPanel());
  page.append(moneyPanel());
  page.append(backupPanel());
  page.append(cloudPanel());
  page.append(integrationsPanel());
  page.append(appearancePanel());
  page.append(trashPanel());
  page.append(diagnosticsPanel());

  return page;

  /* ---------- Security ---------- */

  function securityPanel() {
    const encrypted = persist.isEncrypted();
    const supported = lock.isSupported();

    const rows = [];

    rows.push(settingRow(
      encrypted ? "🔒" : "🔓",
      ru() ? "PIN и шифрование" : "PIN and encryption",
      encrypted
        ? (ru() ? "Данные в браузере зашифрованы вашим PIN" : "Browser data is encrypted with your PIN")
        : (ru() ? "Данные лежат в браузере открытым текстом" : "Data sits in the browser as readable text"),
      encrypted
        ? el("div", { class: "row-actions" }, [
            el("button", { class: "small-button", type: "button", text: t("sec.lockNow"),
                           onclick: () => { store.lockNow(); } }),
            el("button", { class: "small-button danger", type: "button", text: t("sec.removePin"), onclick: removePin })
          ])
        : el("button", { class: "primary-button", type: "button", text: t("sec.setPin"),
                         disabled: supported ? null : true, onclick: setPin })
    ));

    if (encrypted) {
      rows.push(settingRow("⏱",
        t("sec.autoLock"),
        settings.autoLockMinutes
          ? (ru() ? `Через ${settings.autoLockMinutes} мин без активности` : `After ${settings.autoLockMinutes} min idle`)
          : (ru() ? "Выключено" : "Off"),
        el("select", {
          class: "form-control compact",
          onchange: async (event) => { await store.updateSettings({ autoLockMinutes: Number(event.target.value) }); refresh(); }
        }, [0, 5, 15, 30, 60].map((minutes) => el("option", {
          value: String(minutes), selected: Number(settings.autoLockMinutes) === minutes ? "selected" : null,
          text: minutes ? `${minutes} ${ru() ? "мин" : "min"}` : (ru() ? "Выключить" : "Off")
        })))));
    }

    return panel("settings-panel",
      panelHeader(ru() ? "БЕЗОПАСНОСТЬ" : "SECURITY", t("set.security")),
      el("div", { class: "setting-rows" }, rows),
      !supported ? el("p", { class: "panel-note warn", text: ru()
        ? "Этот браузер не поддерживает шифрование WebCrypto — PIN недоступен."
        : "This browser has no WebCrypto support, so the PIN is unavailable." } ) : null,
      el("p", { class: "panel-note", text: ru()
        ? "Nik'Os никогда не принимает seed-фразы, приватные ключи и API-секреты: попытка сохранить такую строку отклоняется в любом поле."
        : "Nik'Os never accepts seed phrases, private keys or API secrets: any attempt to save one is rejected in every field." }));
  }

  async function setPin() {
    /* A forgotten PIN is unrecoverable, so a backup is taken first — not
       suggested, taken — before encryption is switched on. */
    const proceed = await confirmDialog({
      title: t("sec.setPin"),
      message: t("sec.backupFirst"),
      confirmLabel: ru() ? "Скачать копию и продолжить" : "Download a backup and continue"
    });
    if (!proceed) return;
    downloadBackup();

    const first = el("input", { class: "form-control", type: "password", inputmode: "numeric",
                                autocomplete: "new-password", maxlength: "12", "data-autofocus": "true" });
    const second = el("input", { class: "form-control", type: "password", inputmode: "numeric",
                                 autocomplete: "new-password", maxlength: "12" });
    const error = el("p", { class: "form-error" });

    const dialog = openDialog({
      title: t("sec.setPin"),
      subtitle: t("sec.setPinHint"),
      size: "narrow",
      body: el("div", { class: "record-form" }, [
        el("label", { class: "form-field wide" }, [el("span", { class: "form-label", text: t("sec.enterPin") }), first]),
        el("label", { class: "form-field wide" }, [el("span", { class: "form-label", text: t("sec.repeatPin") }), second]),
        error
      ]),
      footer: el("div", { class: "dialog-actions" }, [
        el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
        el("button", { class: "primary-button", type: "button", text: t("sec.setPin"), onclick: apply })
      ])
    });

    async function apply() {
      const pin = first.value.trim();
      if (!/^\d{4,12}$/.test(pin)) { error.textContent = t("sec.pinTooShort"); return; }
      if (pin !== second.value.trim()) { error.textContent = t("sec.pinMismatch"); return; }

      const result = await persist.enableEncryption({
        version: 3, records: store.allRecords(), audit: store.getAudit(),
        settings: store.getSettings(), rates: store.getRates()
      }, pin);

      if (result.result !== persist.RESULT.OK) { error.textContent = t("sec.storageFull"); return; }
      dialog.close();
      toast(t("sec.pinEnabled"), { tone: "success" });
      refresh();
    }
  }

  async function removePin() {
    const ok = await confirmDialog({
      title: t("sec.removePin"),
      message: ru() ? "Данные снова будут храниться открытым текстом в этом браузере." : "Data will be stored as readable text in this browser again.",
      confirmLabel: t("sec.removePin"), tone: "danger"
    });
    if (!ok) return;
    await persist.disableEncryption({
      version: 3, records: store.allRecords(), audit: store.getAudit(),
      settings: store.getSettings(), rates: store.getRates()
    });
    toast(t("sec.pinRemoved"));
    refresh();
  }

  /* ---------- Money & rates ---------- */

  function moneyPanel() {
    const rates = store.getRates();
    const manualRows = CURRENCY_CODES.filter((code) => code !== settings.baseCurrency);

    return panel("settings-panel",
      panelHeader(ru() ? "ДЕНЬГИ" : "MONEY", t("set.rates")),
      el("div", { class: "setting-rows" }, [
        settingRow("◎", t("money.baseCurrency"),
          ru() ? "К ней сводится чистый капитал и денежный поток" : "Net worth and cashflow are expressed in it",
          el("select", {
            class: "form-control compact",
            onchange: async (event) => { await store.updateSettings({ baseCurrency: event.target.value }); refresh(); }
          }, CURRENCY_CODES.map((code) => el("option", {
            value: code, selected: settings.baseCurrency === code ? "selected" : null,
            text: `${code} ${CURRENCIES[code].symbol}`
          })))),

        settingRow("⇅", t("set.autoRates"), t("set.autoRatesHint"),
          el("label", { class: "switch" }, [
            el("input", {
              type: "checkbox", checked: settings.autoRates ? "checked" : null,
              onchange: async (event) => { await store.updateSettings({ autoRates: event.target.checked }); refresh(); }
            }),
            el("span", { class: "switch-track", "aria-hidden": "true" })
          ])),

        settingRow("⌛", t("money.rateSource"),
          rates?.fetchedAt
            ? `${sourceLabel(rates, getLocale())} · ${formatDate(rates.fetchedAt, "medium")}${isStale(rates) ? (ru() ? " · устарели" : " · stale") : ""}`
            : (ru() ? "Курсы ещё не загружались" : "Rates have not been fetched yet"),
          el("button", { class: "small-button", type: "button", text: t("money.refreshRates"),
                         onclick: async () => { const done = await refreshRates({ force: true }); toast(done.ok ? t("money.ratesUpdated") : t("money.ratesFailed"), { tone: done.ok ? "success" : "warn" }); refresh(); } }))
      ]),

      el("details", { class: "settings-details" }, [
        el("summary", { text: ru() ? "Свои курсы вручную" : "Manual rates" }),
        el("p", { class: "panel-note", text: ru()
          ? "Ручной курс всегда важнее загруженного — на случай, когда у вас своя сделка по своему курсу."
          : "A manual rate always beats a fetched one — for when your own deal had its own rate." }),
        el("div", { class: "manual-rates" }, manualRows.map((code) => el("label", { class: "manual-rate" }, [
          el("span", { text: `1 ${code} =` }),
          el("input", {
            class: "form-control compact", type: "text", inputmode: "decimal",
            value: rates?.manual?.[code] ?? "",
            placeholder: rates?.perRub?.[code] ? String(Math.round(rates.perRub[code] * 100) / 100) : "",
            onchange: async (event) => {
              const value = Number(String(event.target.value).replace(",", "."));
              const next = { ...(store.getRates() || {}), manual: { ...(store.getRates()?.manual || {}) } };
              if (Number.isFinite(value) && value > 0) next.manual[code] = value;
              else delete next.manual[code];
              await store.setRates(next);
              refresh();
            }
          }),
          el("span", { text: "RUB" })
        ])))
      ]));
  }

  /* ---------- Backup ---------- */

  function backupPanel() {
    const usage = persist.usage();
    const demoCount = countDemo(store.allRecords());

    return panel("settings-panel",
      panelHeader(ru() ? "ДАННЫЕ" : "DATA", t("set.backup")),
      el("div", { class: "setting-rows" }, [
        settingRow("↓", t("set.exportData"),
          settings.lastBackupAt
            ? `${ru() ? "Последняя" : "Last"}: ${formatDate(settings.lastBackupAt, "medium")}`
            : (ru() ? "Копий ещё не было" : "No backup yet"),
          el("button", { class: "primary-button", type: "button", text: t("set.exportData"), onclick: downloadBackup })),

        settingRow("↑", t("set.importData"),
          ru() ? "Заменит текущие записи содержимым файла" : "Replaces current records with the file",
          el("button", { class: "ghost-button", type: "button", text: t("set.importData"), onclick: restoreBackup })),

        usage ? settingRow("▤",
          ru() ? "Место в браузере" : "Browser storage",
          `${(usage.bytes / 1024 / 1024).toFixed(2)} MB ${t("app.of")} ~5 MB · ${usage.percent}%`,
          el("div", { class: "usage-bar" }, [el("i", { style: `width:${Math.min(100, usage.percent)}%`, class: usage.percent > 80 ? "warn" : "" })])) : null,

        settingRow("◫", t("set.demoData"),
          demoCount
            ? (ru() ? `В базе ${demoCount} записей из примера — их можно убрать, не трогая ваши`
                    : `${demoCount} sample records — removable without touching yours`)
            : (ru() ? "Заполнить пример, чтобы посмотреть, как всё работает" : "Load a sample so you can see how it works"),
          el("div", { class: "row-actions" }, [
            demoCount
              ? el("button", { class: "small-button danger", type: "button",
                               text: ru() ? `Удалить пример (${demoCount})` : `Remove sample (${demoCount})`,
                               onclick: removeDemo })
              : el("button", { class: "small-button", type: "button", text: t("set.loadDemo"), onclick: loadDemo }),
            el("button", { class: "small-button danger", type: "button", text: t("set.clearDemo"), onclick: clearAll })
          ]))
      ].filter(Boolean)));
  }

  async function downloadBackup() {
    const payload = store.exportVault();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nikos-backup-${records.today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    await store.updateSettings({ lastBackupAt: new Date().toISOString() });
    toast(ru() ? "Резервная копия скачана" : "Backup downloaded", { tone: "success" });
  }

  function restoreBackup() {
    const picker = el("input", { type: "file", accept: "application/json,.json", hidden: true });
    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      picker.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let parsed;
        try { parsed = JSON.parse(String(reader.result)); }
        catch { toast(ru() ? "Файл не читается" : "The file could not be read", { tone: "danger" }); return; }

        const incoming = Array.isArray(parsed) ? parsed : parsed?.records;
        if (!Array.isArray(incoming)) { toast(ru() ? "Это не резервная копия Nik'Os" : "That is not a Nik'Os backup", { tone: "danger" }); return; }

        const migrated = records.migrateAll(incoming);
        const ok = await confirmDialog({
          title: t("set.importData"),
          message: ru()
            ? `Заменить текущие данные? Сейчас записей: ${store.allRecords().length}, в файле: ${migrated.length}.`
            : `Replace current data? You have ${store.allRecords().length} records; the file has ${migrated.length}.`,
          confirmLabel: t("set.importData"), tone: "danger"
        });
        if (!ok) return;

        const result = await store.replaceAll({
          records: migrated,
          audit: Array.isArray(parsed?.audit) ? parsed.audit : [],
          settings: parsed?.settings || {},
          rates: parsed?.rates || store.getRates()
        });
        if (!result.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }
        toast(ru() ? `Восстановлено записей: ${migrated.length}` : `${migrated.length} records restored`, { tone: "success" });
        refresh();
      };
      reader.readAsText(file);
    });
    document.body.append(picker);
    picker.click();
  }

  async function loadDemo() {
    if (store.allRecords().length) {
      const ok = await confirmDialog({
        title: t("set.loadDemo"),
        message: ru() ? "Пример добавится к вашим записям. Продолжить?" : "The sample will be added to your records. Continue?",
        confirmLabel: t("set.loadDemo")
      });
      if (!ok) return;
    }
    const result = await loadDemoData();
    toast(result.ok
      ? (ru() ? `Добавлено записей: ${result.count}` : `${result.count} sample records added`)
      : t("sec.storageFull"), { tone: result.ok ? "success" : "danger" });
    refresh();
  }

  async function removeDemo() {
    const count = countDemo(store.allRecords());
    const ok = await confirmDialog({
      title: ru() ? "Удалить пример" : "Remove the sample",
      message: ru()
        ? `Будут удалены только ${count} записей из примера. Ваши собственные и данные из WHOOP останутся на месте.`
        : `Only the ${count} sample records are removed. Your own records and anything from WHOOP stay.`,
      confirmLabel: ru() ? "Удалить пример" : "Remove sample", tone: "danger"
    });
    if (!ok) return;
    const ids = store.allRecords().filter(isDemoRecord).map((record) => record.id);
    const result = await clearDemoData();
    if (!result.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }
    // Remove them in the cloud too, or the next sync brings them all back.
    if (cloud.isConnected()) await cloud.deleteRecords(ids);
    toast(ru() ? `Удалено записей из примера: ${result.count}` : `${result.count} sample records removed`, { tone: "success" });
    refresh();
  }

  async function clearAll() {
    const ok = await confirmDialog({
      title: t("set.clearDemo"),
      message: ru()
        ? "Удалить ВСЕ записи без возможности восстановления? Сначала скачайте резервную копию."
        : "Delete ALL records permanently? Download a backup first.",
      detail: countOf(store.allRecords().length, PLURALS.record),
      confirmLabel: t("rec.deleteForever"), tone: "danger"
    });
    if (!ok) return;
    await store.replaceAll({ records: [], audit: [], settings: store.getSettings(), rates: store.getRates() });
    if (cloud.isConnected()) await cloud.deleteAllRecords();
    toast(ru() ? "Все записи удалены" : "All records deleted");
    refresh();
  }

  /* ---------- Cloud ---------- */

  function cloudPanel() {
    const config = cloud.loadConfig() || {};
    const connected = cloud.isConnected();

    const url = el("input", { class: "form-control", type: "url", value: config.url || "",
                              placeholder: "https://your-project.supabase.co", autocomplete: "off" });
    const key = el("input", { class: "form-control", type: "password", value: config.key || "",
                              placeholder: ru() ? "Публичный anon-ключ" : "Public anon key", autocomplete: "off" });
    const email = el("input", { class: "form-control", type: "email", value: config.email || "",
                                placeholder: "you@example.com", autocomplete: "username" });
    const password = el("input", { class: "form-control", type: "password", placeholder: "••••••••", autocomplete: "current-password" });
    const consent = el("input", { type: "checkbox", checked: cloud.hasConsent() ? "checked" : null });
    const status = el("span", { class: "security-badge", text: cloud.statusLabel(connected ? "connected" : "idle") });
    const error = el("p", { class: "form-error" });

    cloud.onStatus((state, detail) => {
      status.textContent = cloud.statusLabel(state);
      if (state === "error") error.textContent = detail || "";
    });

    const submit = async (signUp) => {
      error.textContent = "";
      const result = await cloud.connect({
        url: url.value.trim(), key: key.value.trim(), email: email.value.trim(),
        password: password.value, signUp, consent: consent.checked
      });
      password.value = "";
      if (!result.ok) { error.textContent = result.message; return; }
      toast(result.pending ? result.message : (ru() ? "Синхронизировано" : "Synced"), { tone: result.pending ? "warn" : "success" });
      refresh();
    };

    return panel("settings-panel cloud-panel",
      panelHeader(t("set.cloudSync"), ru() ? "Одни и те же записи на всех устройствах" : "The same records on every device", status),
      el("p", { class: "panel-note", text: ru()
        ? "Подключается ваш собственный проект Supabase. Записи защищены политиками доступа по вашему аккаунту; пароль нигде не сохраняется."
        : "Connects your own Supabase project. Records are protected by row-level security scoped to your account; the password is never stored." }),
      connected
        ? el("div", { class: "setting-rows" }, [
            settingRow("☁", ru() ? "Подключено как" : "Connected as", cloud.currentUserEmail() || "",
              el("div", { class: "row-actions" }, [
                el("button", { class: "small-button", type: "button", text: ru() ? "Синхронизировать" : "Sync now",
                               onclick: async () => { const done = await cloud.syncAll(); toast(done.ok ? (ru() ? "Синхронизировано" : "Synced") : (done.message || "—"), { tone: done.ok ? "success" : "danger" }); refresh(); } }),
                el("button", { class: "small-button danger", type: "button", text: ru() ? "Выйти" : "Sign out",
                               onclick: async () => { await cloud.signOut(); refresh(); } })
              ]))
          ])
        : el("div", { class: "cloud-grid" }, [
            labelled(ru() ? "URL проекта Supabase" : "Supabase project URL", url),
            labelled(ru() ? "Публичный anon-ключ" : "Public anon key", key),
            labelled("Email", email),
            labelled(ru() ? "Пароль аккаунта" : "Account password", password),
            el("label", { class: "switch-row wide" }, [consent,
              el("span", { text: ru()
                ? "Я понимаю, что записи будут отправляться в мой проект Supabase"
                : "I understand my records will be sent to my Supabase project" })]),
            error,
            el("div", { class: "row-actions wide" }, [
              el("button", { class: "primary-button", type: "button", text: ru() ? "Подключить" : "Connect", onclick: () => submit(false) }),
              el("button", { class: "ghost-button", type: "button", text: ru() ? "Создать аккаунт" : "Create account", onclick: () => submit(true) })
            ])
          ]),
      el("p", { class: "panel-note", text: ru()
        ? "Перед первым подключением выполните supabase/schema.sql в SQL-редакторе вашего проекта."
        : "Run supabase/schema.sql in your project SQL editor before connecting for the first time." }));
  }

  /* ---------- Integrations ---------- */

  function integrationsPanel() {
    return panel("settings-panel",
      panelHeader(ru() ? "ИСТОЧНИКИ" : "SOURCES",
        ru() ? "Данные, которые приходят сами" : "Data that arrives on its own"),
      el("div", { class: "setting-rows" }, [whoopRow(refresh)]),
      el("p", { class: "panel-note", text: ru()
        ? "Доступ только на чтение. Токены хранятся на сервере вашего проекта Supabase и в браузер не попадают."
        : "Read-only access. Tokens live in your own Supabase project and never reach the browser." }));
  }

  /* ---------- Appearance ---------- */

  function appearancePanel() {
    return panel("settings-panel",
      panelHeader(ru() ? "ВИД" : "APPEARANCE", ru() ? "Язык и тема" : "Language and theme"),
      el("div", { class: "setting-rows" }, [
        settingRow("⌘", t("set.language"), ru() ? "Русский" : "English",
          el("select", {
            class: "form-control compact",
            onchange: (event) => { setLocale(event.target.value); refresh(); }
          }, [
            el("option", { value: "ru", selected: ru() ? "selected" : null, text: "Русский" }),
            el("option", { value: "en", selected: ru() ? null : "selected", text: "English" })
          ])),
        settingRow("◐", t("set.theme"),
          settings.theme === "light" ? t("app.themeLight") : t("app.themeDark"),
          el("select", {
            class: "form-control compact",
            onchange: async (event) => {
              document.body.dataset.theme = event.target.value;
              await store.updateSettings({ theme: event.target.value });
              refresh();
            }
          }, [
            el("option", { value: "dark", selected: settings.theme !== "light" ? "selected" : null, text: t("app.themeDark") }),
            el("option", { value: "light", selected: settings.theme === "light" ? "selected" : null, text: t("app.themeLight") })
          ]))
      ]));
  }

  /* ---------- Trash ---------- */

  function trashPanel() {
    const deleted = store.deletedRecords();
    const archived = store.archivedRecords();

    return panel("settings-panel",
      panelHeader(ru() ? "КОРЗИНА И АРХИВ" : "TRASH & ARCHIVE", t("rec.trash")),
      el("p", { class: "panel-note", text: t("rec.trashHint") }),
      deleted.length
        ? el("div", { class: "record-list" }, deleted.map((record) => el("div", { class: "record-row is-archived" }, [
            el("span", { class: "record-icon", text: "🗑" }),
            el("span", { class: "record-main" }, [
              el("strong", { text: record.name }),
              el("small", { text: `${typeLabel(record.type)} · ${formatDate(record.deletedAt, "medium")}` })
            ]),
            el("span", { class: "record-actions" }, [
              el("button", { class: "small-button", type: "button", text: t("app.restore"),
                             onclick: async () => { await records.restoreRecord(record.id); toast(t("app.restore")); refresh(); } }),
              el("button", { class: "small-button danger", type: "button", text: t("rec.deleteForever"),
                             onclick: async () => {
                               const ok = await confirmDialog({ title: t("rec.deleteForever"), message: t("rec.confirmPurge"),
                                                                detail: record.name, confirmLabel: t("rec.deleteForever"), tone: "danger" });
                               if (!ok) return;
                               await records.purgeRecord(record.id);
                               refresh();
                             } })
            ])
          ])))
        : emptyState(ru() ? "Корзина пуста." : "Trash is empty."),
      archived.length
        ? el("details", { class: "settings-details" }, [
            el("summary", { text: `${t("rec.showArchive")} (${archived.length})` }),
            recordList("settings-archive", archived, { empty: "", compact: true })
          ])
        : null);
  }

  /* ---------- Diagnostics ---------- */

  function diagnosticsPanel() {
    const output = el("pre", { class: "diagnostics-output" });
    return panel("settings-panel",
      panelHeader(ru() ? "ПРОВЕРКА" : "DIAGNOSTICS", ru() ? "Самотестирование" : "Self-test"),
      el("p", { class: "panel-note", text: ru()
        ? "Проверяет арифметику денег, правила капитала, отказ от seed-фраз и шифрование — прямо в этом браузере."
        : "Checks money arithmetic, net-worth rules, seed-phrase rejection and encryption — right here in this browser." }),
      el("button", { class: "ghost-button", type: "button", text: ru() ? "Запустить проверку" : "Run self-test",
                     onclick: async () => {
                       output.textContent = ru() ? "Проверяю…" : "Running…";
                       const suite = await import("../selftest.js?v=20260827-081615");
                       const cryptoFailures = await lock.selfTest();
                       const all = [...suite.results.failures, ...cryptoFailures];
                       output.textContent = all.length
                         ? `${ru() ? "ПРОВАЛЕНО" : "FAILED"} ${all.length}:\n${all.map((line) => `  ✗ ${line}`).join("\n")}`
                         : (ru() ? "✓ Все проверки пройдены." : "✓ All checks passed.");
                     } }),
      output);
  }
}

function settingRow(icon, title, subtitle, control) {
  return el("div", { class: "setting-row" }, [
    el("span", { class: "setting-icon", "aria-hidden": "true", text: icon }),
    el("span", { class: "setting-copy" }, [
      el("strong", { text: title }),
      subtitle ? el("small", { text: subtitle }) : null
    ]),
    el("span", { class: "setting-control" }, [control])
  ]);
}

const labelled = (text, control) =>
  el("label", { class: "form-field" }, [el("span", { class: "form-label", text }), control]);
