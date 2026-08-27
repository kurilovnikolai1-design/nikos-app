/* Settings: security, backups, rates, sync, appearance, trash, diagnostics. */

import { el, panel, panelHeader, emptyState, toast, confirmDialog, openDialog } from "../ui.js?v=20260827-144534";
import { t, getLocale, setLocale, formatDate, countOf, plural, PLURALS, typeLabel, categoryLabel } from "../i18n.js?v=20260827-144534";
import { CURRENCY_CODES, CURRENCIES, formatMoney } from "../money.js?v=20260827-144534";
import { refresh, pageHeading, recordList } from "../render.js?v=20260827-144534";
import { SOURCES, sourceLabel, isStale, COINS } from "../rates.js?v=20260827-144534";
import * as lock from "../lock.js?v=20260827-144534";
import * as persist from "../persist.js?v=20260827-144534";
import * as store from "../store.js?v=20260827-144534";
import * as records from "../records.js?v=20260827-144534";
import * as cloud from "../cloud.js?v=20260827-144534";
import * as notify from "../notify.js?v=20260827-144534";
import * as backups from "../backups.js?v=20260827-144534";
import { refreshRates } from "../main-rates.js?v=20260827-144534";
import { loadDemoData, clearDemoData, countDemo, isDemoRecord } from "../demo.js?v=20260827-144534";
import { whoopRow } from "../whoop.js?v=20260827-144534";

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

        /* Reminders leaving the screen. The permission is requested here and
           only here, on a deliberate tap: a browser refused once never asks
           again, so it must never be triggered by merely opening the app. */
        settingRow("🔔", ru() ? "Напоминания" : "Reminders",
          notify.permission() === "denied"
            ? (ru() ? "Уведомления запрещены в настройках браузера — снимите запрет там"
                    : "Notifications are blocked in the browser — allow them there first")
            : (ru() ? "Напомнить о платеже, сроке документа, пересдаче анализа"
                    : "Payments, expiring documents, tests to retake"),
          notify.isSupported()
            ? el("label", { class: "switch" }, [
                el("input", {
                  type: "checkbox",
                  checked: notify.isEnabled() && notify.permission() === "granted" ? "checked" : null,
                  disabled: notify.permission() === "denied" ? "disabled" : null,
                  onchange: async (event) => {
                    if (!event.target.checked) {
                      notify.setEnabled(false);
                      await notify.unsubscribePush();
                      refresh();
                      return;
                    }
                    const result = await notify.requestPermission();
                    if (result !== "granted") {
                      toast(ru() ? "Браузер не разрешил уведомления" : "The browser did not allow notifications",
                            { tone: "warn" });
                    } else {
                      /* With the cloud connected the device also registers for
                         push, which is the only way a reminder arrives with the
                         app closed. Without it, local notifications still work. */
                      if (notify.canPush()) await notify.subscribePush();
                      const done = await notify.showDue();
                      toast(done.shown
                        ? (ru() ? `Показано напоминаний: ${done.shown}` : `${done.shown} reminders shown`)
                        : (ru() ? "Включено. Сейчас напоминать не о чем." : "On. Nothing is due right now."),
                        { tone: "success" });
                    }
                    refresh();
                  }
                }),
                el("span", { class: "switch-track", "aria-hidden": "true" })
              ])
            : el("small", { class: "form-hint", text: ru() ? "Браузер не поддерживает" : "Not supported here" })),

        /* Optional by design: Russian tickers price themselves for free, and
           foreign ones fall back to a hand-entered valuation without a key. */
        settingRow("▤", ru() ? "Ключ для иностранных бумаг" : "Key for foreign tickers",
          settings.quotesApiKey
            ? (ru() ? "Ключ сохранён — иностранные бумаги оцениваются автоматически"
                    : "Key saved — foreign tickers are priced automatically")
            : (ru() ? "Бесплатный ключ Finnhub. Без него укажите цену вручную. Российские бумаги работают и так."
                    : "A free Finnhub key. Without it, enter foreign prices by hand. Russian tickers work regardless."),
          el("input", {
            class: "form-control compact", type: "password", autocomplete: "off",
            value: settings.quotesApiKey || "",
            placeholder: ru() ? "не задан" : "not set",
            onchange: async (event) => {
              await store.updateSettings({ quotesApiKey: event.target.value.trim() });
              toast(ru() ? "Сохранено" : "Saved", { tone: "success" });
              refresh();
            }
          })),

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
    const demoCount = countDemo(store.allRecords());
    const storageRow = el("div", { class: "setting-row" }, [
      el("span", { class: "setting-icon", "aria-hidden": "true", text: "▤" }),
      el("span", { class: "setting-copy" }, [
        el("strong", { text: ru() ? "Место для данных" : "Storage" }),
        el("small", { text: ru() ? "Считаю…" : "Checking…" })
      ]),
      el("span", { class: "setting-control" }, [el("div", { class: "usage-bar" }, [el("i", { style: "width:0%" })])])
    ]);
    void describeStorage(storageRow);

    /* Automatic copies, listed. A backup nobody can see is a backup nobody
       trusts, and the moment it is needed is the worst moment to find out
       whether it exists. */
    const autoRow = el("div", { class: "setting-row" }, [
      el("span", { class: "setting-icon", "aria-hidden": "true", text: "⎘" }),
      el("span", { class: "setting-copy" }, [
        el("strong", { text: ru() ? "Копии на устройстве" : "Copies on this device" }),
        el("small", { text: ru() ? "Проверяю…" : "Checking…" })
      ]),
      el("span", { class: "setting-control" })
    ]);
    void describeBackups(autoRow);

    return panel("settings-panel",
      panelHeader(ru() ? "ДАННЫЕ" : "DATA", t("set.backup")),
      el("div", { class: "setting-rows" }, [
        autoRow,

        settingRow("↓", t("set.exportData"),
          settings.lastBackupAt
            ? `${ru() ? "Последняя" : "Last"}: ${formatDate(settings.lastBackupAt, "medium")}`
            : (ru() ? "Копий ещё не было" : "No backup yet"),
          el("button", { class: "primary-button", type: "button", text: t("set.exportData"), onclick: downloadBackup })),

        settingRow("↑", t("set.importData"),
          ru() ? "Заменит текущие записи содержимым файла" : "Replaces current records with the file",
          el("button", { class: "ghost-button", type: "button", text: t("set.importData"), onclick: restoreBackup })),

        storageRow,

        /* The sample is only offered to an empty vault. Loading invented
           records next to real ones is a way to end up unsure which of your
           own numbers you can trust, and no explanation on the button undoes
           that once it has happened. */
        (demoCount || store.allRecords().length === 0)
          ? settingRow("◫", t("set.demoData"),
              demoCount
                ? (ru() ? `В базе ${demoCount} записей из примера — их можно убрать, не трогая ваши`
                        : `${demoCount} sample records — removable without touching yours`)
                : (ru() ? "Заполнить пример, чтобы посмотреть, как всё работает" : "Load a sample so you can see how it works"),
              el("div", { class: "row-actions" }, [
                demoCount
                  ? el("button", { class: "small-button danger", type: "button",
                                   text: ru() ? `Удалить пример (${demoCount})` : `Remove sample (${demoCount})`,
                                   onclick: removeDemo })
                  : el("button", { class: "small-button", type: "button", text: t("set.loadDemo"), onclick: loadDemo })
              ]))
          : null,

        settingRow("⌦", ru() ? "Очистить всё" : "Erase everything",
          ru() ? "Удаляет все записи и файлы с этого устройства. Отменить нельзя."
               : "Removes every record and file from this device. Cannot be undone.",
          el("button", { class: "small-button danger", type: "button", text: t("set.clearDemo"), onclick: clearAll }))
      ].filter(Boolean)));
  }

  async function describeBackups(row) {
    const list = await backups.listBackups();
    const copy = row.querySelector(".setting-copy small");
    const control = row.querySelector(".setting-control");

    if (!list.length) {
      copy.textContent = ru()
        ? "Пока нет. Первая появится автоматически при следующем открытии."
        : "None yet. The first is written automatically on a later visit.";
      return;
    }

    const newest = await backups.readBackup(list[0].key);
    copy.textContent = ru()
      ? `${countOf(list.length, PLURALS.copy)} · последняя ${formatDate(newest?.at?.slice(0, 10) || "", "medium")}, в ней ${countOf(newest?.recordCount ?? 0, PLURALS.record)}`
      : `${list.length} copies · latest ${formatDate(newest?.at?.slice(0, 10) || "", "medium")}, ${newest?.recordCount ?? "?"} records`;

    control.textContent = "";
    control.append(el("button", {
      class: "small-button", type: "button",
      text: ru() ? "Восстановить" : "Restore",
      onclick: () => openRestoreDialog(list)
    }));
  }

  function openRestoreDialog(list) {
    const body = el("div", { class: "restore-list" });

    const dialog = openDialog({
      title: ru() ? "Восстановить из копии" : "Restore from a copy",
      subtitle: ru() ? "Текущие записи будут заменены" : "Current records will be replaced",
      size: "form",
      body,
      footer: el("p", { class: "panel-note", text: ru() ? backups.BACKUP_NOTE.ru : backups.BACKUP_NOTE.en })
    });

    void (async () => {
      for (const item of list) {
        const stored = await backups.readBackup(item.key);
        if (!stored) continue;
        body.append(el("button", {
          class: "restore-row", type: "button",
          onclick: () => confirmRestore(stored, dialog)
        }, [
          el("strong", { text: formatDate(stored.at.slice(0, 10), "long") }),
          el("small", { text: ru()
            ? `${countOf(stored.recordCount, PLURALS.record)} · ${stored.at.slice(11, 16)}`
            : `${stored.recordCount} records · ${stored.at.slice(11, 16)}` })
        ]));
      }
      if (!body.childElementCount) {
        body.append(el("p", { class: "panel-note", text: ru() ? "Копии не читаются." : "The copies could not be read." }));
      }
    })();
  }

  async function confirmRestore(stored, dialog) {
    const now = store.allRecords().length;
    const confirmed = await confirmDialog({
      title: ru() ? "Заменить все записи?" : "Replace every record?",
      message: ru()
        ? `Сейчас записей: ${now}. В копии: ${stored.recordCount}. Текущие будут заменены целиком.`
        : `You have ${now} records now; the copy holds ${stored.recordCount}. The current set is replaced entirely.`,
      detail: formatDate(stored.at.slice(0, 10), "long"),
      confirmLabel: ru() ? "Восстановить" : "Restore",
      tone: "danger"
    });
    if (!confirmed) return;

    /* A copy of where we are now, before replacing it — restoring the wrong
       copy must not be the one action with no way back. */
    await backups.writeBackup(store.exportVault());

    const result = await store.replaceAll(stored.vault);
    dialog.close();
    toast(result.ok
      ? (ru() ? "Восстановлено" : "Restored")
      : (ru() ? "Не удалось восстановить" : "Could not restore"),
      { tone: result.ok ? "success" : "danger" });
    refresh();
  }

  /* Real numbers from the browser, and whether it has promised to keep them. */
  async function describeStorage(row) {
    const [usage, persistence] = await Promise.all([persist.usage(), persist.requestPersistence()]);
    const mb = (value) => `${(value / 1024 / 1024).toFixed(1)} МБ`;
    const backend = persist.backend() === "indexeddb"
      ? (ru() ? "IndexedDB — без ограничения в 5 МБ" : "IndexedDB — no 5 MB ceiling")
      : (ru() ? "localStorage — потолок около 5 МБ" : "localStorage — about 5 MB");
    const kept = persistence.persisted
      ? (ru() ? "браузер обещал не удалять" : "browser will not evict it")
      : persistence.supported
        ? (ru() ? "браузер пока не гарантирует сохранность" : "browser has not guaranteed persistence yet")
        : "";

    const copy = row.querySelector(".setting-copy small");
    if (copy) {
      copy.textContent = usage
        ? `${mb(usage.bytes)} ${t("app.of")} ${mb(usage.limit)} · ${backend}${kept ? ` · ${kept}` : ""}`
        : backend;
    }
    const bar = row.querySelector(".usage-bar i");
    if (bar && usage) {
      bar.style.width = `${Math.max(1, Math.min(100, usage.percent))}%`;
      bar.className = usage.percent > 80 ? "warn" : "";
    }
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
        const existing = store.allRecords().length;

        /* Replacing everything is right for restoring a backup and wrong for
           bringing in a decade of lab history — that would silently delete the
           records already here. The choice belongs to the owner, so it is asked
           rather than assumed. */
        const mode = existing
          ? await importChoice(existing, migrated.length)
          : "replace";
        if (!mode) return;

        let result;
        if (mode === "merge") {
          const byId = new Map(store.allRecords().map((record) => [record.id, record]));
          let added = 0;
          let updated = 0;
          for (const record of migrated) {
            if (byId.has(record.id)) updated += 1; else added += 1;
            byId.set(record.id, record);
          }
          result = await store.replaceAll({
            records: [...byId.values()],
            audit: store.getAudit(),
            settings: store.getSettings(),
            rates: store.getRates()
          });
          if (result.ok) {
            toast(ru() ? `Добавлено: ${added}, обновлено: ${updated}` : `${added} added, ${updated} updated`,
                  { tone: "success", duration: 6000 });
          }
        } else {
          result = await store.replaceAll({
            records: migrated,
            audit: Array.isArray(parsed?.audit) ? parsed.audit : [],
            settings: { ...store.getSettings(), ...(parsed?.settings || {}) },
            rates: parsed?.rates || store.getRates()
          });
          if (result.ok) {
            toast(ru() ? `Восстановлено записей: ${migrated.length}` : `${migrated.length} records restored`, { tone: "success" });
          }
        }

        if (!result.ok) { toast(t("sec.storageFull"), { tone: "danger" }); return; }
        if (cloud.isConnected()) await cloud.syncAll();
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

  /* Two very different intentions share one file picker, so they are separated
     explicitly instead of one being assumed. */
  function importChoice(existing, incoming) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };

      const dialog = openDialog({
        title: t("set.importData"),
        subtitle: ru()
          ? `Сейчас записей: ${existing}. В файле: ${incoming}.`
          : `You have ${existing} records. The file has ${incoming}.`,
        size: "narrow",
        body: el("div", { class: "quick-grid import-choice" }, [
          el("button", {
            class: "quick-tile", type: "button",
            onclick: () => { finish("merge"); dialog.close(); }
          }, [
            el("span", { class: "quick-icon", text: "＋" }),
            el("span", { text: ru() ? "Добавить к существующим" : "Add to what is here" }),
            el("small", { text: ru() ? "Ничего не удаляется" : "Nothing is removed" })
          ]),
          el("button", {
            class: "quick-tile danger", type: "button",
            onclick: () => { finish("replace"); dialog.close(); }
          }, [
            el("span", { class: "quick-icon", text: "⟳" }),
            el("span", { text: ru() ? "Заменить всё" : "Replace everything" }),
            el("small", { text: ru() ? `Удалит текущие ${existing}` : `Deletes the current ${existing}` })
          ])
        ]),
        onClose: () => finish(null)
      });
    });
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
            /* What is still owed to the cloud. Without this the owner has no
               way to tell a finished sync from one that never ran. */
            settingRow("⇅", ru() ? "Не отправлено" : "Waiting to upload",
              (() => {
                const pending = cloud.pendingCount();
                const last = cloud.lastPushedAt();
                if (pending) {
                  return ru()
                    ? `${pending} ${plural(pending, PLURALS.record)} — отправятся сами`
                    : `${pending} records — will upload on their own`;
                }
                return last
                  ? (ru() ? `Всё отправлено, последняя запись ${formatDate(last.slice(0, 10), "medium")}`
                          : `All uploaded, latest ${formatDate(last.slice(0, 10), "medium")}`)
                  : (ru() ? "Всё отправлено" : "All uploaded");
              })()),
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
                       const suite = await import("../selftest.js?v=20260827-144534");
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
