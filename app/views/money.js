/* Capital, Debts, Cashflow, Investments, Crypto. */

import { el, panel, panelHeader, metricCard, emptyState, toast, confirmDialog, openDialog } from "../ui.js?v=20260827-144201";
import { t, getLocale, formatDate, relativeDays, countOf, categoryLabel, statusLabel,
         plural, PLURALS, formatNumber, typeLabel, frequencyLabel } from "../i18n.js?v=20260827-144201";
import { formatMoney, formatQuantity, parseAmount, CURRENCIES } from "../money.js?v=20260827-144201";
import { netWorth, cashflow, recurringLoad, periodRange, buildSnapshot, monthlyEquivalentMinor } from "../finance.js?v=20260827-144201";
import { budgetStatus, BUDGET_STATE, BUDGET_NOTE } from "../budget.js?v=20260827-144201";
import { refreshRates } from "../main-rates.js?v=20260827-144201";
import { goalsOverview, totalOutstanding, GOAL_STATE, GOAL_NOTE } from "../goals.js?v=20260827-144201";
import { portfolio, PNL_STATE, PNL_NOTE } from "../positions.js?v=20260827-144201";
import { QUOTES_NOTE } from "../quotes.js?v=20260827-144201";
import { cryptoUsdPrice, sourceLabel, isStale, missingRates, COINS } from "../rates.js?v=20260827-144201";
import { isVerified } from "../schema.js?v=20260827-144201";
import { recordList, addButton, pageHeading, exclusionNote, chipRow, refresh, sparkline } from "../render.js?v=20260827-144201";
import { openRecordForm } from "../form.js?v=20260827-144201";
import * as store from "../store.js?v=20260827-144201";
import * as records from "../records.js?v=20260827-144201";

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

/* Where money is going, as opposed to where it is. */
function goalsPanel(all) {
  const overview = goalsOverview(all, base(), store.getRates());
  const add = addButton("goal", t("app.add"), refresh, "small-button");

  if (!overview.length) {
    return panel("records-panel goals-panel",
      panelHeader(ru() ? "ЦЕЛИ" : "GOALS", ru() ? "Куда идут деньги" : "Where money is going", add),
      emptyState(ru()
        ? "Накопить на что-то, закрыть долг к сроку, собрать подушку. Nik'Os посчитает, сколько осталось и сколько нужно откладывать в месяц."
        : "Save up for something, clear a debt by a date, build a safety net. Nik'Os works out what is left and what it takes per month.",
        `${t("app.add")}: ${typeLabel("goal").toLowerCase()}`,
        () => openRecordForm("goal", null, { onSaved: refresh })));
  }

  const outstanding = totalOutstanding(overview);

  return panel("records-panel goals-panel",
    panelHeader(ru() ? "ЦЕЛИ" : "GOALS",
      outstanding
        ? (ru() ? `Не хватает ${money(outstanding)}` : `${money(outstanding)} still needed`)
        : (ru() ? "Все цели закрыты" : "All goals reached"),
      add),

    el("div", { class: "goal-list" }, overview.map((item) => {
      const reached = item.state === GOAL_STATE.REACHED;
      const behind = item.state === GOAL_STATE.BEHIND;

      return el("button", {
        class: `goal-row${reached ? " reached" : ""}${behind ? " behind" : ""}`,
        type: "button",
        onclick: () => openRecordForm("goal", item.record, { onSaved: refresh })
      }, [
        el("div", { class: "goal-head" }, [
          el("strong", { text: item.record.name }),
          el("span", { class: "goal-figures", text: item.state === GOAL_STATE.NO_TARGET
            ? (ru() ? "не указана сумма цели" : "no target amount")
            : `${money(item.savedMinor)} ${ru() ? "из" : "of"} ${money(item.targetMinor)}` })
        ]),

        item.state === GOAL_STATE.NO_TARGET ? null : el("div", { class: "goal-track" }, [
          el("i", { style: `width:${Math.max(2, Math.round(item.share * 100))}%` })
        ]),

        el("small", { class: "goal-note", text: goalLine(item) })
      ]);
    })),

    el("p", { class: "panel-note", text: ru() ? GOAL_NOTE.ru : GOAL_NOTE.en }));

  function goalLine(item) {
    if (item.state === GOAL_STATE.NO_TARGET) {
      return ru() ? "Впишите, сколько нужно собрать — тогда появится прогресс."
                  : "Add the amount needed and the progress will appear.";
    }
    if (item.state === GOAL_STATE.REACHED) {
      return ru() ? "Собрано полностью." : "Fully funded.";
    }
    if (item.state === GOAL_STATE.NO_DEADLINE) {
      return ru() ? `Не хватает ${money(item.remainingMinor)}. Срок не указан.`
                  : `${money(item.remainingMinor)} short. No date set.`;
    }
    if (item.overdue) {
      return ru() ? `Срок прошёл, не хватает ${money(item.remainingMinor)}.`
                  : `Past the date, ${money(item.remainingMinor)} short.`;
    }
    const perMonth = money(item.neededPerMonthMinor);
    const months = Math.max(1, Math.round(item.monthsLeft));
    const pace = item.achievedPerMonthMinor !== null
      ? (ru() ? ` Пока выходит ${money(item.achievedPerMonthMinor)} в месяц.`
              : ` So far it is ${money(item.achievedPerMonthMinor)} a month.`)
      : "";
    return (ru()
      ? `Чтобы успеть за ${countOf(months, PLURALS.month)}, нужно ${perMonth} в месяц.`
      : `To make it in ${months} months takes ${perMonth} a month.`) + pace;
  }
}

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

  page.append(goalsPanel(all));

  page.append(panel("records-panel",
    panelHeader(ru() ? "СЧЕТА" : "ACCOUNTS", ru() ? "Ваши счета" : "Your accounts",
      addButton("account", t("app.add"), refresh, "small-button")),
    recordList("capital-accounts", accounts, {
      empty: ru() ? "Добавьте банковский, брокерский или наличный счёт." : "Add a bank, brokerage or cash account.",
      addType: "account"
    })));

  page.append(panel("snapshot-panel",
    panelHeader(ru() ? "ИСТОРИЯ" : "HISTORY", t("money.snapshotHistory")),
    /* Snapshots have been recorded since the rebuild and only ever listed. A
       list of figures answers "сколько было тогда"; the line answers "куда
       это идёт", which is the reason to keep them. */
    netWorthChart(snapshots),
    snapshots.length
      ? el("div", { class: "snapshot-list" }, snapshots.slice(0, 12).map(snapshotRow))
      : emptyState(t("money.snapshotEmpty"), t("money.takeSnapshot"), takeSnapshot)));

  return page;

  /* One point per snapshot, oldest first, plus today's figure at the end so
     the line reaches the present instead of stopping at the last time the
     owner remembered to take one. */
  function netWorthChart(list) {
    const points = [...list]
      .filter((record) => Number.isFinite(record.snapshot?.totalMinor) && record.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((record) => ({ date: record.date, value: record.snapshot.totalMinor / 100 }));

    if (worth.hasAnything) {
      const today = records.today();
      if (!points.length || points.at(-1).date !== today) {
        points.push({ date: today, value: worth.totalMinor / 100 });
      }
    }

    /* Two points is a line between two moments, not a history. */
    if (points.length < 3) return null;

    const first = points[0];
    const last = points.at(-1);
    const changeMinor = Math.round((last.value - first.value) * 100);

    return el("div", { class: "networth-chart" }, [
      el("div", { class: "networth-head" }, [
        el("span", { class: "panel-kicker", text: ru() ? "ЧИСТЫЙ КАПИТАЛ ПО СНИМКАМ" : "NET WORTH BY SNAPSHOT" }),
        el("b", { class: changeMinor >= 0 ? "positive" : "negative",
                  text: `${changeMinor > 0 ? "+" : ""}${money(changeMinor)}` }),
        el("small", { text: ru()
          ? `с ${formatDate(first.date, "medium").replace(/\.$/, "")}`
          : `since ${formatDate(first.date, "medium")}` })
      ]),
      sparkline(points, { tone: changeMinor >= 0 ? "cyan" : "amber", height: 96 })
    ]);
  }

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

/* What is left to spend, and how long it has to last. */
function budgetPanel() {
  const status = budgetStatus(store.liveRecords(), base(), store.getRates(), store.getSettings());

  if (status.state === BUDGET_STATE.UNSET) {
    const suggestion = status.suggestion;
    return panel("budget-panel",
      panelHeader(ru() ? "БЮДЖЕТ НА МЕСЯЦ" : "MONTHLY BUDGET", ru() ? "Не задан" : "Not set"),
      el("p", { class: "panel-note", text: ru()
        ? "Поставьте предел на месяц — и вместо «потрачено столько-то» будет видно, сколько осталось и на сколько дней."
        : "Set a monthly limit and the panel will show what is left and for how many days, instead of only what was spent." }),
      suggestion
        ? el("p", { class: "panel-note", text: ru()
            ? `За последние ${suggestion.months} мес. вы тратили в среднем ${money(suggestion.averageMinor)} в месяц.`
            : `Over the last ${suggestion.months} months you spent ${money(suggestion.averageMinor)} a month on average.` })
        : null,
      el("div", { class: "budget-actions" }, [
        el("button", { class: "primary-button", type: "button",
          text: ru() ? "Задать бюджет" : "Set a budget",
          onclick: () => openBudgetDialog(suggestion?.averageMinor ?? null) })
      ]));
  }

  const tone = status.state === BUDGET_STATE.OVER ? "negative"
    : status.state === BUDGET_STATE.CLOSE ? "warn" : "positive";

  return panel(`budget-panel ${tone}`,
    panelHeader(ru() ? "ОСТАЛОСЬ ДО КОНЦА МЕСЯЦА" : "LEFT THIS MONTH",
      ru() ? `${money(status.spentMinor)} из ${money(status.limitMinor)}` : `${money(status.spentMinor)} of ${money(status.limitMinor)}`,
      el("button", { class: "text-button", type: "button", text: ru() ? "Изменить" : "Change",
                     onclick: () => openBudgetDialog(status.limitMinor) })),

    el("div", { class: "budget-headline" }, [
      el("strong", { class: tone, text: money(status.remainingMinor) }),
      el("small", { text: status.remainingMinor >= 0
        ? (ru() ? `${money(status.perDayMinor)} в день на ${countOf(status.daysLeft, PLURALS.day)}`
                : `${money(status.perDayMinor)} a day for ${status.daysLeft} days`)
        : (ru() ? `Перерасход. До конца месяца ${countOf(status.daysLeft, PLURALS.day)}.`
                : `Over budget, with ${status.daysLeft} days to go.`) })
    ]),

    el("div", { class: "budget-track", role: "presentation" }, [
      el("i", { class: "budget-fill", style: `width:${Math.min(100, Math.round(status.share * 100))}%` }),
      /* Where the month itself has got to — the only fair thing to compare
         the spending against. */
      el("b", { class: "budget-pace", style: `left:${Math.min(100, Math.round(status.expectedShare * 100))}%`,
                title: ru() ? "Сегодняшний день месяца" : "Today within the month" })
    ]),

    status.ahead && status.remainingMinor >= 0
      ? el("p", { class: "panel-note warn", text: ru()
          ? `Потрачено ${Math.round(status.share * 100)}% бюджета, а месяц прошёл на ${Math.round(status.expectedShare * 100)}%.`
          : `${Math.round(status.share * 100)}% of the budget is gone, and the month is ${Math.round(status.expectedShare * 100)}% through.` })
      : null,

    status.excludedCount
      ? el("p", { class: "panel-note", text: ru()
          ? `Не посчитано записей: ${status.excludedCount}. Реальный расход может быть больше.`
          : `${status.excludedCount} records could not be counted, so the real figure may be higher.` })
      : null,

    el("p", { class: "panel-note", text: ru() ? BUDGET_NOTE.ru : BUDGET_NOTE.en }));
}

function openBudgetDialog(currentMinor) {
  const input = el("input", {
    class: "form-control", type: "text", inputmode: "decimal", "data-autofocus": "true",
    value: currentMinor ? String(Math.round(currentMinor / 100)) : "",
    placeholder: ru() ? "Например: 150000" : "e.g. 150000"
  });

  const dialog = openDialog({
    title: ru() ? "Бюджет на месяц" : "Monthly budget",
    subtitle: ru() ? "Сколько вы готовы тратить" : "How much you are willing to spend",
    size: "form",
    body: el("div", { class: "form-grid" }, [
      el("label", { class: "form-field wide" }, [
        el("span", { class: "form-label", text: `${ru() ? "Предел" : "Limit"}, ${base()}` }),
        input
      ]),
      el("p", { class: "panel-note", text: ru()
        ? "Пустое поле убирает бюджет. Предел ни на что не влияет, кроме этой панели — ничего не блокируется."
        : "Leaving it empty removes the budget. The limit only drives this panel; nothing is blocked." })
    ]),
    footer: el("div", { class: "dialog-actions" }, [
      el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => dialog.close() }),
      el("button", { class: "primary-button", type: "button", text: t("app.save"), onclick: save })
    ])
  });

  async function save() {
    const raw = input.value.trim();
    const minor = raw ? parseAmount(raw, base()) : 0;
    if (raw && minor === null) { toast(ru() ? "Не понял сумму" : "Could not read that amount", { tone: "warn" }); return; }
    await store.updateSettings({ budgetMinor: minor || 0 });
    dialog.close();
    refresh();
  }
}

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

  /* Only for the current month: "осталось до конца месяца" means nothing when
     the period bar is pointing at last March. */
  if (cashflowState.period === "month" && cashflowState.offset === 0) {
    page.append(budgetPanel());
  }

  const note = exclusionNote(flow.excluded);
  if (note) {
    page.append(el("div", { class: "note-row" }, [note,
      confirmPendingButton(flow.excluded.unconfirmed, ru() ? "Подтвердить и посчитать" : "Confirm and count")]));
  }

  /* What leaves every month, itemised. The dashboard has shown the total
     since the rebuild, and a total cannot be argued with — a list can: this
     is where a forgotten subscription becomes visible. */
  if (recurring.active.length) {
    const monthly = recurring.active
      .map((record) => ({ record, minor: monthlyEquivalentMinor(record, base(), store.getRates()) }))
      .filter((entry) => entry.minor !== null)
      .sort((a, b) => b.minor - a.minor);

    page.append(panel("records-panel recurring-panel",
      panelHeader(ru() ? "УХОДИТ КАЖДЫЙ МЕСЯЦ" : "LEAVES EVERY MONTH",
        ru() ? `${money(recurring.expenseMinor)} расходов, ${money(recurring.incomeMinor)} доходов`
             : `${money(recurring.expenseMinor)} out, ${money(recurring.incomeMinor)} in`),

      el("div", { class: "recurring-list" }, monthly.map(({ record, minor }) => el("button", {
        class: `recurring-row ${record.type}`, type: "button",
        onclick: () => openRecordForm(record.type, record, { onSaved: refresh })
      }, [
        el("span", { class: "recurring-name", text: record.name }),
        el("small", { text: [categoryLabel(record.type, record.category),
                             record.frequency ? frequencyLabel(record.frequency) : null]
                             .filter(Boolean).join(" · ") }),
        el("b", { text: `${record.type === "expense" ? "−" : "+"}${money(minor)}` })
      ]))),

      recurring.noRate.length
        ? el("p", { class: "panel-note warn", text: ru()
            ? `Без курса, не в сумме: ${recurring.noRate.length}.`
            : `${recurring.noRate.length} have no rate and are not counted.` })
        : null,

      el("p", { class: "panel-note", text: ru()
        ? "Суммы приведены к месяцу: годовой платёж делится на двенадцать, недельный умножается."
        : "Amounts are shown per month: a yearly payment is divided by twelve, a weekly one multiplied." })));
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
    [addButton("security", typeLabel("security"), refresh, "ghost-button"),
     addButton("investment", typeLabel("investment"), refresh, "primary-button")]));

  /* Securities first: they have a public price, so their figures are the ones
     that can be trusted without the owner having updated anything. */
  const securities = store.recordsOfType("security");
  if (securities.length) {
    page.append(positionsPanel(securities, ["security"],
      ru() ? "БУМАГИ" : "SECURITIES",
      ru() ? "Добавьте тикер и количество — цена подтянется сама." : "Add a ticker and a quantity — the price is fetched for you.",
      "security"));
    page.append(el("p", { class: "panel-note", text: ru() ? QUOTES_NOTE.ru : QUOTES_NOTE.en }));
  }

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

/* A position, not just a holding: what it is worth, what it cost, and the
   difference. Shared between crypto and securities because the two differ
   only in where the price comes from. */
function positionsPanel(records, types, title, emptyText, addType) {
  const book = portfolio(records, base(), store.getRates(), types);

  if (!records.length) {
    return panel("records-panel",
      panelHeader(title, ru() ? "Наблюдаемые активы" : "Observed holdings"),
      recordList(`${addType}-holdings`, records, { empty: emptyText, addType }));
  }

  const sign = (minor) => `${minor > 0 ? "+" : ""}${money(minor)}`;

  return panel("records-panel positions-panel",
    panelHeader(title,
      book.pnlMinor === null
        ? (ru() ? `${money(book.valueMinor)} · прибыль не полная` : `${money(book.valueMinor)} · partial profit`)
        : (ru() ? `${money(book.valueMinor)} · ${sign(book.pnlMinor)}` : `${money(book.valueMinor)} · ${sign(book.pnlMinor)}`),
      addButton(addType, t("app.add"), refresh, "small-button")),

    el("div", { class: "position-list" }, book.positions.map((position) => {
      const record = position.record;
      const up = position.state === PNL_STATE.UP;
      const down = position.state === PNL_STATE.DOWN;

      return el("button", {
        class: `position-row${up ? " up" : ""}${down ? " down" : ""}`, type: "button",
        onclick: () => openRecordForm(record.type, record, { onSaved: refresh })
      }, [
        el("div", { class: "position-head" }, [
          el("strong", { text: record.name || record.coin || record.ticker || "—" }),
          el("span", { class: "position-value", text: position.valueMinor != null ? money(position.valueMinor) : "—" })
        ]),

        el("div", { class: "position-detail" }, [
          record.quantity ? el("span", { text: `${formatQuantity(record.quantity)} ${record.coin || record.ticker || ""}`.trim() }) : null,
          /* Per unit, and said so: without the unit these read as totals and
             a five-figure "вход" next to a six-figure "сейчас" is confusing. */
          position.entryPriceMinor
            ? el("span", { text: (() => {
                const unit = record.coin || record.ticker || "";
                return ru()
                  ? `вход ${money(position.entryPriceMinor)}${unit ? ` за ${unit}` : " за штуку"} → сейчас ${money(position.currentPriceMinor)}`
                  : `in at ${money(position.entryPriceMinor)}${unit ? ` per ${unit}` : " each"} → now ${money(position.currentPriceMinor)}`;
              })() })
            : null
        ]),

        position.state === PNL_STATE.NO_COST
          ? el("small", { class: "position-pnl muted", text: ru()
              ? "Впишите, сколько вложили — тогда будет видно прибыль."
              : "Add what it cost and the profit will show." })
          : position.state === PNL_STATE.NO_PRICE
            ? el("small", { class: "position-pnl muted", text: ru() ? "Нет цены" : "No price" })
            : el("small", { class: "position-pnl", text:
                `${sign(position.pnlMinor)}${position.pnlPercent === null ? "" : `  ${position.pnlPercent > 0 ? "+" : ""}${position.pnlPercent.toFixed(1)}%`}` })
      ]);
    })),

    /* A position with no price is missing from both halves of the total, so
       the total is about fewer positions than the list shows. Saying so is
       the difference between a partial figure and a wrong one. */
    book.unpriced
      ? el("p", { class: "panel-note warn", text: ru()
          ? `Позиций без котировки: ${book.unpriced}. В сумму и в прибыль они не вошли.`
          : `${book.unpriced} positions have no price and are not in the total.` })
      : null,

    book.withoutCost
      ? el("p", { class: "panel-note warn", text: ru()
          ? `Позиций без цены входа: ${book.withoutCost}. Пока они есть, общая прибыль не считается.`
          : `${book.withoutCost} positions have no cost basis, so the total profit is not shown.` })
      : null,

    el("p", { class: "panel-note", text: ru() ? PNL_NOTE.ru : PNL_NOTE.en }));
}

export function cryptoView() {
  const holdings = store.recordsOfType("crypto");
  const rates = store.getRates();
  const page = document.createDocumentFragment();

  page.append(pageHeading(t("view.crypto"),
    ru() ? "Только наблюдение. Ключи и вывод средств невозможны по устройству продукта." : "Observation only. Keys and withdrawals are impossible by design.",
    addButton("crypto", typeLabel("crypto"), refresh),
    ru() ? "ТОЛЬКО ЧТЕНИЕ · НИКОГДА НЕ ХРАНЕНИЕ" : "OBSERVED ONLY · NEVER CUSTODY"));

  /* Every holding entered, priced or not. Skipping the unconfirmed ones used
     to print a confident zero next to a screen full of coins, which is how
     "я вписал 50 BTC и ничего не появилось" happens. */
  let totalUsdMinor = 0;
  let priced = 0;
  let unpricedCoins = [];
  const pending = holdings.filter((record) => !isVerified(record) && record.status !== "archived");

  for (const record of holdings) {
    if (record.status === "archived") continue;
    const price = cryptoUsdPrice(rates, record.coin);
    if (price && Number.isFinite(Number(record.quantity))) {
      totalUsdMinor += Math.round(Number(record.quantity) * price * 100);
      priced += 1;
    } else if (record.coin) {
      unpricedCoins.push(record.coin);
    }
  }

  /* Nothing priced is not the same as nothing owned. A confident "0 $" above a
     screen listing coins says the holdings are worthless; a dash says the app
     does not know yet, which is the truth. */
  const nothingPriced = holdings.length > 0 && priced === 0;

  page.append(el("div", { class: "metric-grid" }, [
    metricCard({ kicker: ru() ? "ОЦЕНКА, USD" : "VALUE, USD",
                 value: nothingPriced ? "—" : formatMoney(totalUsdMinor, "USD", getLocale()),
                 note: nothingPriced
                   ? (ru() ? "цены не загружены" : "prices not loaded")
                   : `${priced} ${ru() ? plural(priced, PLURALS.position) : "priced"} ${ru() ? "с ценой" : "positions"}` }),
    metricCard({ kicker: ru() ? "ПОЗИЦИЙ" : "HOLDINGS", value: String(holdings.length) }),
    metricCard({ kicker: ru() ? "ЦЕНЫ ОТ" : "PRICES FROM",
                 value: rates?.cryptoFetchedAt ? "CoinGecko" : "—",
                 note: rates?.cryptoFetchedAt ? formatDate(rates.cryptoFetchedAt, "short") : (ru() ? "не загружены" : "not loaded") })
  ]));

  if (nothingPriced) {
    page.append(el("div", { class: "inline-warning" }, [
      el("strong", { text: ru() ? "Цены не загружены" : "Prices are not loaded" }),
      el("span", { text: ru()
        ? " — поэтому оценка не показана. Ваши монеты на месте."
        : " — so no valuation is shown. Your holdings are intact." }),
      el("button", { class: "small-button", type: "button", text: t("money.refreshRates"),
        onclick: async () => {
          const done = await refreshRates({ force: true });
          toast(done.ok ? t("money.ratesUpdated") : t("money.ratesFailed"), { tone: done.ok ? "success" : "danger" });
          refresh();
        } })
    ]));
  }

  /* The value above is real; the capital screen still leaves these out until
     they are confirmed. Saying so — with the fix attached — is the difference
     between a number that disagrees with another number for no visible reason
     and one that explains itself. */
  if (pending.length) {
    page.append(el("div", { class: "inline-warning" }, [
      el("strong", { text: ru()
        ? `Не подтверждено: ${pending.length}`
        : `${pending.length} not confirmed` }),
      el("span", { text: ru()
        ? " — эти позиции показаны здесь, но не входят в чистый капитал."
        : " — shown here, but not counted in net worth." }),
      confirmPendingButton(pending, ru() ? "Подтвердить и посчитать" : "Confirm and count")
    ]));
  }

  if (unpricedCoins.length) {
    page.append(el("p", { class: "panel-note warn", text: ru()
      ? `Нет автоматической цены для: ${[...new Set(unpricedCoins)].join(", ")}. Укажите оценку вручную в записи.`
      : `No automatic price for: ${[...new Set(unpricedCoins)].join(", ")}. Enter a valuation in the record.` }));
  }

  page.append(el("div", { class: "safety-banner" }, [
    el("strong", { text: ru() ? "Nik'Os не принимает seed-фразы и приватные ключи." : "Nik'Os does not accept seed phrases or private keys." }),
    el("p", { text: ru()
      ? "Это не обещание в тексте, а проверка в коде: попытка сохранить такую строку будет отклонена в любом поле."
      : "This is not a promise in copy but a check in code: any attempt to save such a string is rejected in every field." })
  ]));

  page.append(positionsPanel(holdings, ["crypto"],
    ru() ? "ПОЗИЦИИ" : "HOLDINGS",
    ru() ? "Добавьте монету и количество — цена подтянется сама." : "Add a coin and a quantity — the price is fetched for you.",
    "crypto"));

  page.append(el("p", { class: "panel-note", text: ru()
    ? `Автоматическая цена доступна для: ${Object.keys(COINS).join(", ")}. Для остальных укажите оценку вручную.`
    : `Automatic pricing covers: ${Object.keys(COINS).join(", ")}. For anything else, enter a valuation manually.` }));

  return page;
}
