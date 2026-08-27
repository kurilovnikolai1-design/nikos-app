/* Capital, Debts, Cashflow, Investments, Crypto. */

import { el, panel, panelHeader, metricCard, emptyState, toast, confirmDialog } from "../ui.js";
import { t, getLocale, formatDate, relativeDays, countOf, categoryLabel, statusLabel,
         PLURALS, formatNumber, typeLabel } from "../i18n.js";
import { formatMoney, formatQuantity, CURRENCIES } from "../money.js";
import { netWorth, cashflow, recurringLoad, periodRange, buildSnapshot, monthlyEquivalentMinor } from "../finance.js";
import { cryptoUsdPrice, sourceLabel, isStale, missingRates, COINS } from "../rates.js";
import { isVerified } from "../schema.js";
import { recordList, addButton, pageHeading, exclusionNote, chipRow, refresh } from "../render.js";
import { openRecordForm } from "../form.js";
import * as store from "../store.js";
import * as records from "../records.js";

const ru = () => getLocale() === "ru";
const base = () => store.getSettings().baseCurrency || "RUB";
const money = (minor) => formatMoney(minor, base(), getLocale());

/* A single line the owner can trust: where the rate came from and when. */
export function rateFootnote() {
  const rates = store.getRates();
  if (!rates?.fetchedAt) {
    return el("small", { class: "rate-note warn", text: ru() ? "Курсы не загружены — суммы только в исходных валютах" : "No rates loaded — amounts stay in their own currency" });
  }
  const stale = isStale(rates);
  return el("small", { class: `rate-note${stale ? " warn" : ""}` , text:
    `${t("money.rateSource")}: ${sourceLabel(rates, getLocale())} · ${formatDate(rates.fetchedAt, "short")}${stale ? (ru() ? " · устарели" : " · stale") : ""}` });
}

function confirmPendingButton(pending, label = null) {
  if (!pending.length) return null;
  return el("button", {
    class: "ghost-button", type: "button",
    text: label || `${t("money.confirmAll")} (${pending.length})`,
    onclick: async () => {
      const ok = await confirmDialog({
        title: t("money.confirmAll"),
        message: ru()
          ? `Подтвердить ${countOf(pending.length, PLURALS.record)}? После этого они войдут в расчёты.`
          : `Confirm ${pending.length} records? They will then count toward your totals.`,
        confirmLabel: t("app.confirm")
      });
      if (!ok) return;
      const result = await records.confirmMany(pending.map((item) => item.id));
      if (result.ok) { toast(t("rec.confirmed"), { tone: "success" }); refresh(); }
    }
  });
}

/* ---------- Capital ---------- */

export function capitalView() {
  const all = store.liveRecords();
  const worth = netWorth(all, base(), store.getRates());
  const accounts = store.recordsOfType("account");
  const snapshots = store.recordsOfType("snapshot").sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const pending = [...worth.excluded.unconfirmed];

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.capital"),
    ru() ? "Всё, чем вы владеете и что должны — в одном числе." : "Everything you own and owe, in one number.",
    [confirmPendingButton(pending), addButton("account", `${t("app.add")}: ${typeLabel("account").toLowerCase()}`, refresh, "primary-button"),
     el("button", { class: "ghost-button", type: "button", text: `＋ ${t("money.takeSnapshot")}`, onclick: takeSnapshot })]));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: t("money.netWorth"), value: worth.hasAnything ? money(worth.totalMinor) : "—",
                 note: worth.hasAnything ? `${ru() ? "активы" : "assets"} ${money(worth.grossMinor)} − ${ru() ? "долги" : "debt"} ${money(worth.liabilityMinor)}` : ru() ? "Добавьте первый счёт" : "Add your first account",
                 tone: "wide" }),
    metricCard({ kicker: t("money.liquid"), value: money(worth.buckets.liquid),
                 note: countOf(accounts.filter(isVerified).length, PLURALS.account) }),
    metricCard({ kicker: t("money.invested"), value: money(worth.buckets.invested + worth.buckets.crypto),
                 note: worth.buckets.crypto ? `${ru() ? "включая крипто" : "incl. crypto"} ${money(worth.buckets.crypto)}` : "" }),
    metricCard({ kicker: t("money.property"), value: money(worth.buckets.property) }),
    metricCard({ kicker: t("money.owedToMe"), value: money(worth.buckets.receivable) }),
    metricCard({ kicker: t("money.debt"), value: money(worth.buckets.liability), tone: worth.buckets.liability ? "negative" : "" }),
    metricCard({ kicker: t("money.confidence"), value: worth.confidence === null ? "—" : `${worth.confidence}%`,
                 note: worth.excludedCount ? `${worth.excludedCount} ${ru() ? "не в расчёте" : "excluded"}` : ru() ? "всё подтверждено" : "all confirmed" })
  ]));

  page.append(el("div", { class: "note-row" }, [rateFootnote(), exclusionNote(worth.excluded)]));

  const missing = missingRates(store.getRates(), all.filter((r) => r.currency).map((r) => r.currency));
  if (missing.length) {
    page.append(el("div", { class: "inline-warning" }, [
      el("strong", { text: ru() ? `Нет курса для ${missing.join(", ")}` : `No rate for ${missing.join(", ")}` }),
      el("span", { text: ru() ? " — эти суммы не вошли в чистый капитал." : " — those amounts are not in net worth." })
    ]));
  }

  page.append(panel("records-panel",
    panelHeader(ru() ? "СЧЕТА" : "ACCOUNTS", ru() ? "Ваши счета" : "Your accounts",
      addButton("account", t("app.add"), refresh, "small-button")),
    recordList("capital-accounts", accounts, {
      empty: ru() ? "Добавьте банковский, брокерский или наличный счёт." : "Add a bank, brokerage or cash account.",
      addType: "account"
    })));

  page.append(panel("snapshot-panel",
    panelHeader(ru() ? "ИСТОРИЯ" : "HISTORY", t("money.snapshotHistory")),
    snapshots.length
      ? el("div", { class: "snapshot-list" }, snapshots.slice(0, 12).map(snapshotRow))
      : emptyState(t("money.snapshotEmpty"), t("money.takeSnapshot"), takeSnapshot)));

  return page;

  function snapshotRow(record) {
    const payload = record.snapshot || {};
    return el("div", { class: "snapshot-row" }, [
      el("span", {}, [
        el("strong", { text: formatDate(record.date, "long") }),
        el("small", { text: [
          payload.rateSource ? `${t("money.rateSource")}: ${payload.rateSource}` : null,
          payload.confidence !== null && payload.confidence !== undefined ? `${t("money.confidence").toLowerCase()} ${payload.confidence}%` : null
        ].filter(Boolean).join(" · ") })
      ]),
      el("b", { text: formatMoney(record.amountMinor, record.currency || base(), getLocale()) })
    ]);
  }

  async function takeSnapshot() {
    const snapshot = buildSnapshot(store.liveRecords(), base(), store.getRates());
    if (!snapshot) {
      toast(ru() ? "Сначала подтвердите хотя бы одну денежную запись." : "Confirm at least one money record first.", { tone: "warn" });
      return;
    }
    const draft = {
      ...records.blankRecord("snapshot"),
      name: `${t("cmd.netWorth")} · ${formatDate(records.today(), "medium")}`,
      amountMinor: snapshot.totalMinor,
      currency: snapshot.base,
      date: records.today(),
      snapshot,
      details: [
        `${t("money.liquid")}: ${money(snapshot.buckets.liquid)}`,
        `${t("money.invested")}: ${money(snapshot.buckets.invested + snapshot.buckets.crypto)}`,
        `${t("money.property")}: ${money(snapshot.buckets.property)}`,
        `${t("money.owedToMe")}: ${money(snapshot.buckets.receivable)}`,
        `${t("money.debt")}: ${money(snapshot.buckets.liability)}`
      ].join("\n")
    };
    const saved = await records.saveRecord(draft);
    if (saved.ok) { toast(t("money.snapshotSaved"), { tone: "success" }); refresh(); }
  }
}

/* ---------- Debts ---------- */

export function debtsView() {
  const receivables = store.recordsOfType("receivable");
  const payables = store.recordsOfType("payable");
  const rates = store.getRates();
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.debts"),
    ru() ? "Кто кому должен, сколько и когда." : "Who owes whom, how much, and when.",
    [addButton("receivable", ru() ? "Мне должны" : "Owed to me", refresh, "ghost-button"),
     addButton("payable", ru() ? "Я должен" : "I owe", refresh, "primary-button")]));

  const worth = netWorth(store.liveRecords(), base(), rates);

  page.append(el("div", { class: "debt-grid" }, [
    el("div", { class: "debt-card receivable" }, [
      el("span", { class: "panel-kicker", text: t("money.owedToMe") }),
      el("strong", { class: "debt-total", text: money(worth.buckets.receivable) }),
      el("p", { text: receivables.length
        ? countOf(receivables.length, PLURALS.record)
        : (ru() ? "Записей пока нет." : "Nothing recorded yet.") })
    ]),
    el("div", { class: "debt-card payable" }, [
      el("span", { class: "panel-kicker", text: t("money.debt") }),
      el("strong", { class: "debt-total", text: money(worth.buckets.liability) }),
      el("p", { text: payables.length
        ? countOf(payables.length, PLURALS.record)
        : (ru() ? "Записей пока нет." : "Nothing recorded yet.") })
    ])
  ]));

  page.append(rateFootnote());

  page.append(panel("records-panel",
    panelHeader(ru() ? "ДЕБИТОРКА" : "RECEIVABLES", ru() ? "Мне должны" : "Owed to me",
      addButton("receivable", t("app.add"), refresh, "small-button")),
    recordList("debts-receivable", receivables, {
      empty: ru() ? "Никто вам ничего не должен — или ещё не записано." : "Nobody owes you — or it is not recorded yet.",
      addType: "receivable"
    })));

  page.append(panel("records-panel",
    panelHeader(ru() ? "КРЕДИТОРКА" : "PAYABLES", ru() ? "Я должен" : "I owe",
      addButton("payable", t("app.add"), refresh, "small-button")),
    recordList("debts-payable", payables, {
      empty: ru() ? "Обязательств пока нет." : "No liabilities yet.",
      addType: "payable"
    })));

  return page;
}

/* ---------- Cashflow ---------- */

const cashflowState = { period: "month", offset: 0 };

export function cashflowView() {
  const all = store.liveRecords();
  const range = periodRange(cashflowState.period, cashflowState.offset);
  const flow = cashflow(all, base(), store.getRates(), range);
  const recurring = recurringLoad(all, base(), store.getRates());
  const entries = [...flow.incomeRecords, ...flow.expenseRecords]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.cashflow"),
    ru() ? "Что пришло, что ушло и что уходит каждый месяц." : "What came in, what went out, and what leaves every month.",
    [addButton("income", typeLabel("income"), refresh, "ghost-button"),
     addButton("expense", typeLabel("expense"), refresh, "primary-button")]));

  page.append(el("div", { class: "period-bar" }, [
    chipRow([
      { value: "week", label: t("app.week") },
      { value: "month", label: t("app.month") },
      { value: "year", label: t("app.year") },
      { value: "all", label: t("app.all") }
    ], cashflowState.period, (value) => { cashflowState.period = value; cashflowState.offset = 0; refresh(); }),
    cashflowState.period === "all" ? null : el("div", { class: "period-nav" }, [
      el("button", { class: "small-button", type: "button", "aria-label": ru() ? "Раньше" : "Earlier", text: "←",
                     onclick: () => { cashflowState.offset -= 1; refresh(); } }),
      el("span", { class: "period-label", text: periodLabel(range) }),
      el("button", { class: "small-button", type: "button", "aria-label": ru() ? "Позже" : "Later", text: "→",
                     onclick: () => { cashflowState.offset += 1; refresh(); } })
    ])
  ]));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: t("money.income"), value: money(flow.incomeMinor), tone: "positive" }),
    metricCard({ kicker: t("money.expenses"), value: money(flow.expenseMinor), tone: "negative" }),
    metricCard({ kicker: t("money.net"), value: money(flow.netMinor),
                 note: ru() ? "доходы минус расходы" : "income minus expenses",
                 tone: flow.netMinor >= 0 ? "positive" : "negative" }),
    metricCard({ kicker: t("money.monthlyLoad"), value: money(recurring.expenseMinor),
                 note: `${recurring.active.length} ${ru() ? "обязательств" : "obligations"}` })
  ]));

  const note = exclusionNote(flow.excluded);
  if (note) {
    page.append(el("div", { class: "note-row" }, [note,
      confirmPendingButton(flow.excluded.unconfirmed, ru() ? "Подтвердить и посчитать" : "Confirm and count")]));
  }

  if (flow.byCategory.length) {
    const max = flow.byCategory[0][1] || 1;
    page.append(panel("breakdown-panel",
      panelHeader(ru() ? "КУДА УХОДИТ" : "WHERE IT GOES", ru() ? "Расходы по категориям" : "Expenses by category"),
      el("div", { class: "breakdown-list" }, flow.byCategory.map(([category, minor]) =>
        el("div", { class: "breakdown-row" }, [
          el("span", { class: "breakdown-label", text: categoryLabel("expense", category) }),
          el("span", { class: "breakdown-bar" }, [
            el("i", { style: `width:${Math.max(3, Math.round((minor / max) * 100))}%` })
          ]),
          el("b", { text: money(minor) })
        ])))));
  }

  page.append(panel("recurring-expenses-panel",
    panelHeader(ru() ? "РЕГУЛЯРНЫЕ" : "RECURRING", ru() ? "Постоянные обязательства" : "Standing obligations",
      el("button", { class: "small-button", type: "button", text: `＋ ${t("app.add")}`,
        onclick: () => openRecordForm("expense", null, { presets: { recurring: true, category: "housing" }, onSaved: refresh }) })),
    el("div", { class: "recurring-summary" }, [
      el("div", {}, [el("span", { class: "panel-kicker", text: t("money.monthlyLoad") }), el("strong", { text: money(recurring.expenseMinor) })]),
      el("div", {}, [el("span", { class: "panel-kicker", text: t("money.dueSoon") }), el("strong", { text: String(recurring.dueSoon.length) })]),
      el("div", {}, [el("span", { class: "panel-kicker", text: t("money.activeCount") }), el("strong", { text: String(recurring.active.length) })])
    ]),
    recordList("cashflow-recurring", recurring.active, {
      empty: ru() ? "Добавьте ипотеку, аренду, коммуналку, страховку или подписки." : "Add mortgage, rent, utilities, insurance or subscriptions.",
      compact: true
    }),
    el("p", { class: "panel-note", text: ru()
      ? "Это планы платежей. Фактические оплаты живут отдельными расходами, поэтому одна сумма никогда не считается дважды."
      : "These are payment plans. Actual payments live as separate expenses, so no amount is ever counted twice." })));

  page.append(panel("records-panel",
    panelHeader(ru() ? "ОПЕРАЦИИ" : "ENTRIES", ru() ? "Доходы и расходы" : "Income and expenses"),
    recordList("cashflow-entries", entries, {
      empty: ru() ? "За этот период операций нет." : "No entries in this period.",
      addType: "expense"
    })));

  return page;

  function periodLabel(currentRange) {
    if (cashflowState.period === "year") return String(currentRange.start.getFullYear());
    if (cashflowState.period === "week") return `${formatDate(isoDate(currentRange.start), "short")} — ${formatDate(isoDate(currentRange.end), "short")}`;
    return new Intl.DateTimeFormat(ru() ? "ru-RU" : "en-US", { month: "long", year: "numeric" }).format(currentRange.start);
  }
}

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/* ---------- Investments ---------- */

const investmentState = { mode: "all" };

export function investmentsView() {
  const all = store.recordsOfType("investment");
  const owned = all.filter((record) => ["confirmed", "active"].includes(record.status));
  const proposed = all.filter((record) => record.status === "unverified");
  const watchlist = all.filter((record) => record.status === "waiting");

  const shown = investmentState.mode === "owned" ? owned
    : investmentState.mode === "proposed" ? proposed
    : investmentState.mode === "watchlist" ? watchlist
    : investmentState.mode === "review" ? all.filter((record) => record.reminderDate)
      .sort((a, b) => String(a.reminderDate).localeCompare(String(b.reminderDate)))
    : all;

  const worth = netWorth(store.liveRecords(), base(), store.getRates());

  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.investments"),
    ru() ? "Владение фиксируется явно. Обсуждаемое — не значит ваше." : "Ownership is explicit. Discussed is not owned.",
    addButton("investment", typeLabel("investment"), refresh)));

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "В РАСЧЁТЕ" : "COUNTED", value: money(worth.buckets.invested),
                 note: countOf(owned.length, PLURALS.record) }),
    metricCard({ kicker: ru() ? "ПРЕДЛОЖЕНО" : "PROPOSED", value: String(proposed.length),
                 note: ru() ? "не в капитале" : "not in net worth" }),
    metricCard({ kicker: ru() ? "НАБЛЮДЕНИЕ" : "WATCHLIST", value: String(watchlist.length) })
  ]));

  page.append(chipRow([
    { value: "all", label: t("app.all"), count: all.length },
    { value: "owned", label: ru() ? "Во владении" : "Owned", count: owned.length },
    { value: "proposed", label: ru() ? "Предложено" : "Proposed", count: proposed.length },
    { value: "watchlist", label: ru() ? "Наблюдение" : "Watchlist", count: watchlist.length },
    { value: "review", label: ru() ? "Пересмотр" : "Review", count: all.filter((r) => r.reminderDate).length }
  ], investmentState.mode, (value) => { investmentState.mode = value; refresh(); }));

  if (investmentState.mode === "review") {
    page.append(panel("records-panel",
      panelHeader(ru() ? "КАЛЕНДАРЬ ПЕРЕСМОТРА" : "REVIEW CALENDAR", ru() ? "Когда вернуться к решению" : "When to revisit"),
      shown.length
        ? el("div", { class: "review-list" }, shown.map((record) => el("div", { class: "review-calendar-row" }, [
            el("span", {}, [
              el("strong", { text: record.name }),
              el("small", { text: `${categoryLabel("investment", record.category)} · ${statusLabel(record.status)}` })
            ]),
            el("time", { datetime: record.reminderDate, text: relativeDays(record.reminderDate) })
          ])))
        : emptyState(ru() ? "Поставьте дату пересмотра инвестиции, и она появится здесь." : "Set a review date on an investment to see it here.")));
    return page;
  }

  page.append(panel("records-panel",
    panelHeader(ru() ? "ПОЗИЦИИ" : "POSITIONS", ru() ? "Ваши инвестиции" : "Your investments"),
    recordList(`investments-${investmentState.mode}`, shown, {
      empty: ru() ? "Добавьте стройку, Jetlend, сделку с перекупщиком или брокерскую позицию." : "Add construction, Jetlend, a car deal or a brokerage position.",
      addType: "investment"
    })));

  return page;
}

/* ---------- Crypto ---------- */

export function cryptoView() {
  const holdings = store.recordsOfType("crypto");
  const rates = store.getRates();
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.crypto"),
    ru() ? "Только наблюдение. Ключи и вывод средств невозможны по устройству продукта." : "Observation only. Keys and withdrawals are impossible by design.",
    addButton("crypto", typeLabel("crypto"), refresh),
    ru() ? "ТОЛЬКО ЧТЕНИЕ · НИКОГДА НЕ ХРАНЕНИЕ" : "OBSERVED ONLY · NEVER CUSTODY"));

  let totalUsdMinor = 0;
  let priced = 0;
  for (const record of holdings) {
    if (!isVerified(record)) continue;
    const price = cryptoUsdPrice(rates, record.coin);
    if (price && Number.isFinite(Number(record.quantity))) {
      totalUsdMinor += Math.round(Number(record.quantity) * price * 100);
      priced += 1;
    }
  }

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "ОЦЕНКА, USD" : "VALUE, USD", value: formatMoney(totalUsdMinor, "USD", getLocale()),
                 note: `${priced} ${ru() ? "позиций с ценой" : "priced positions"}` }),
    metricCard({ kicker: ru() ? "ПОЗИЦИЙ" : "HOLDINGS", value: String(holdings.length) }),
    metricCard({ kicker: ru() ? "ЦЕНЫ ОТ" : "PRICES FROM",
                 value: rates?.cryptoFetchedAt ? "CoinGecko" : "—",
                 note: rates?.cryptoFetchedAt ? formatDate(rates.cryptoFetchedAt, "short") : (ru() ? "не загружены" : "not loaded") })
  ]));

  page.append(el("div", { class: "safety-banner" }, [
    el("strong", { text: ru() ? "Nik'Os не принимает seed-фразы и приватные ключи." : "Nik'Os does not accept seed phrases or private keys." }),
    el("p", { text: ru()
      ? "Это не обещание в тексте, а проверка в коде: попытка сохранить такую строку будет отклонена в любом поле."
      : "This is not a promise in copy but a check in code: any attempt to save such a string is rejected in every field." })
  ]));

  page.append(panel("records-panel",
    panelHeader(ru() ? "ПОЗИЦИИ" : "HOLDINGS", ru() ? "Наблюдаемые активы" : "Observed holdings"),
    recordList("crypto-holdings", holdings, {
      empty: ru() ? "Добавьте монету и количество — цена подтянется сама." : "Add a coin and a quantity — the price is fetched for you.",
      addType: "crypto"
    })));

  page.append(el("p", { class: "panel-note", text: ru()
    ? `Автоматическая цена доступна для: ${Object.keys(COINS).join(", ")}. Для остальных укажите оценку вручную.`
    : `Automatic pricing covers: ${Object.keys(COINS).join(", ")}. For anything else, enter a valuation manually.` }));

  return page;
}
