/* Optional sample data.

   The previous build hard-coded three tasks, three attention rows and three
   projects into the markup, where they could not be edited or removed and
   quietly made the dashboard look busier than the owner's real life. Sample
   data is now opt-in, made of ordinary records, and deletable like any other. */

import * as store from "./store.js?v=20260827-130449";
import { blankRecord } from "./records.js?v=20260827-130449";

const shift = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const make = (type, fields) => ({
  ...blankRecord(type), ...fields,
  source: "demo", isDemo: true,
  details: [fields.details, "Пример данных"].filter(Boolean).join(" · ")
});

export const isDemoRecord = (record) =>
  record?.isDemo === true || record?.source === "demo";

export const countDemo = (records) => records.filter(isDemoRecord).length;

export async function loadDemoData() {
  const sample = [
    /* Money */
    make("account", { name: "Основной счёт", category: "bank", counterparty: "Т-Банк", amountMinor: 1_240_000_00, currency: "RUB", status: "confirmed" }),
    make("account", { name: "Валютный счёт", category: "savings", counterparty: "Т-Банк", amountMinor: 8_400_00, currency: "USD", status: "confirmed" }),
    make("account", { name: "Наличные", category: "cash", amountMinor: 85_000_00, currency: "RUB", status: "confirmed" }),
    make("payable", { name: "Ипотека", category: "mortgage", counterparty: "Сбербанк", amountMinor: 4_180_000_00, currency: "RUB",
                      status: "active", terms: "платёж 17 числа", rate: 8.4, dueDate: shift(9) }),
    make("receivable", { name: "Займ Игорю", category: "friend", counterparty: "Игорь", amountMinor: 350_000_00, currency: "RUB",
                         status: "confirmed", dueDate: shift(21) }),

    /* Cashflow */
    make("income", { name: "Доход от бизнеса", category: "business", amountMinor: 420_000_00, currency: "RUB", status: "confirmed", date: shift(-6) }),
    make("expense", { name: "Продукты", category: "living", amountMinor: 18_400_00, currency: "RUB", status: "confirmed", date: shift(-2) }),
    make("expense", { name: "Бензин", category: "transport", amountMinor: 6_200_00, currency: "RUB", status: "confirmed", date: shift(-4) }),
    make("expense", { name: "Ипотечный платёж", category: "mortgage", counterparty: "Сбербанк", amountMinor: 62_000_00, currency: "RUB",
                      status: "confirmed", recurring: true, frequency: "monthly", nextDueDate: shift(9) }),
    make("expense", { name: "Коммунальные", category: "housing", amountMinor: 9_800_00, currency: "RUB",
                      status: "confirmed", recurring: true, frequency: "monthly", nextDueDate: shift(14) }),

    /* Investments and property */
    make("investment", { name: "Стройка на участке", category: "construction", amountMinor: 2_600_000_00, currency: "RUB",
                         status: "active", reminderDate: shift(30) }),
    make("investment", { name: "Jetlend", category: "jetlend", amountMinor: 480_000_00, costBasisMinor: 400_000_00,
                         currency: "RUB", status: "active" }),
    make("asset", { name: "Квартира", category: "apartment", amountMinor: 11_500_000_00, currency: "RUB", status: "confirmed" }),
    make("asset", { name: "Участок 12 соток", category: "land", amountMinor: 3_200_000_00, currency: "RUB", status: "confirmed", ownershipPercent: 50 }),
    make("asset", { name: "Автомобиль", category: "car", amountMinor: 2_150_000_00, currency: "RUB", status: "confirmed" }),
    make("crypto", { name: "Биткоин", category: "wallet", coin: "BTC", quantity: 0.15, status: "confirmed" }),

    /* Work */
    make("task", { name: "Забрать выписку ЕГРН", category: "property", date: shift(0), dueTime: "11:00", priority: "high", status: "planned" }),
    make("task", { name: "Позвонить подрядчику по смете", category: "business", date: shift(0), dueTime: "15:30", priority: "medium", status: "planned" }),
    make("task", { name: "Оплатить ипотеку", category: "finance", date: shift(9), priority: "high", status: "planned" }),
    make("task", { name: "Записаться к стоматологу", category: "health", date: shift(-3), priority: "medium", status: "planned" }),
    make("project", { name: "Дом на участке", category: "property", status: "active", progress: 62 }),
    make("project", { name: "Личная операционная система", category: "personal", status: "active", progress: 25 }),

    /* Health and sport */
    make("workout", { name: "Зал, ноги", category: "gym", date: shift(-1), duration: 65, intensity: 7, feeling: 4, status: "done" }),
    make("workout", { name: "Пробежка", category: "run", date: shift(-3), duration: 42, distance: 7.4, intensity: 6, feeling: 4, status: "done" }),
    make("workout", { name: "Зал, спина", category: "gym", date: shift(-5), duration: 58, intensity: 7, feeling: 3, status: "done" }),
    make("measurement", { name: "Вес", category: "weight", value: 84.2, date: shift(-21), status: "confirmed" }),
    make("measurement", { name: "Вес", category: "weight", value: 83.4, date: shift(-14), status: "confirmed" }),
    make("measurement", { name: "Вес", category: "weight", value: 82.9, date: shift(-7), status: "confirmed" }),
    make("measurement", { name: "Вес", category: "weight", value: 82.1, date: shift(0), status: "confirmed" }),
    make("measurement", { name: "Сон", category: "sleep", value: 7.2, date: shift(-2), status: "confirmed" }),
    make("measurement", { name: "Сон", category: "sleep", value: 6.4, date: shift(-1), status: "confirmed" }),
    make("measurement", { name: "Пульс покоя", category: "rhr", value: 54, date: shift(-1), status: "confirmed" }),
    make("health", { name: "Годовой чекап", category: "checkup", date: shift(45), status: "planned", reminderDate: shift(38) }),

    /* Context */
    make("person", { name: "Игорь", category: "contractor", counterparty: "Стройбригада", contact: "+7 900 000-00-00" }),
    make("document", { name: "Выписка ЕГРН на участок", category: "property", date: shift(-60), expiresAt: shift(25), status: "confirmed" }),
    make("decision", { name: "Достраивать дом или продать участок", category: "property", status: "active", reminderDate: shift(14),
                       reasoning: "Стройка съедает оборотку, но участок в цене растёт." }),
    make("event", { name: "Куплен участок", category: "property", date: shift(-400) })
  ];

  const result = await store.commit((existing) => existing.concat(sample), "demo-loaded");
  if (result.ok) store.pushAudit({ action: "imported", name: `demo · ${sample.length}` });
  return { ...result, count: sample.length };
}

/* Remove the sample and nothing else. "Clear everything" was the only way to
   get rid of it, which is a poor trade once real records are mixed in. */
export async function clearDemoData() {
  const doomed = store.allRecords().filter(isDemoRecord);
  if (!doomed.length) return { ok: true, count: 0 };
  const ids = new Set(doomed.map((record) => record.id));
  const result = await store.commit((records) => records.filter((record) => !ids.has(record.id)), "demo-cleared");
  if (result.ok) store.pushAudit({ action: "deleted", name: `demo · ${doomed.length}` });
  return { ...result, count: doomed.length };
}
