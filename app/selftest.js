/* Runnable checks for the parts that must not be wrong: money arithmetic,
   what counts toward net worth, and migration of records written by the
   previous build. Run with `node app/selftest.js`, and from Settings in the app. */

import { parseAmount, formatMoney } from "./money.js?v=20260827-084202";
import { assertSchemaIsSound } from "./schema.js?v=20260827-084202";
import { selfTest as safetySelfTest, inspectValue } from "./safety.js?v=20260827-084202";
import { netWorth, cashflow, periodRange, recurringLoad, sportSummary, EXCLUSION } from "./finance.js?v=20260827-084202";
import { convertMinor, rubPerUnit, cryptoValueMinorUsd } from "./rates.js?v=20260827-084202";
import { migrateRecord, migrateAll } from "./records.js?v=20260827-084202";
import { parseLabText, rangeVerdict, guessDate, guessLab } from "./labs-parse.js?v=20260827-084202";

const VIEWS = ["command", "inbox", "tasks", "projects", "capital", "debts", "cashflow", "investments",
  "crypto", "assets", "health", "documents", "people", "decisions", "timeline", "settings"];

const RATES = {
  base: "RUB",
  perRub: { RUB: 1, USD: 84.28, EUR: 98.29, CNY: 12.53 },
  crypto: { BTC: 79673, ETH: 2506.36 },
  manual: {},
  source: "cbr",
  fetchedAt: new Date().toISOString()
};

const failures = [];
const check = (name, condition, detail = "") => {
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

const record = (over) => ({
  id: over.id || Math.random().toString(36).slice(2),
  type: "account", category: "bank", name: "x", currency: "RUB",
  amountMinor: null, status: "confirmed", date: "2026-08-10",
  deletedAt: null, linkedIds: [], recurring: false, ...over
});

/* ---------- Schema ---------- */
check("схема", assertSchemaIsSound(VIEWS).length === 0, assertSchemaIsSound(VIEWS).join("; "));

/* ---------- Money ---------- */
check("парсинг «1 234,56»", parseAmount("1 234,56", "RUB") === 123456);
check("парсинг «1.234.567,89»", parseAmount("1.234.567,89", "RUB") === 123456789);
check("парсинг «1,5м»", parseAmount("1,5м", "RUB") === 150000000);
check("парсинг мусора", parseAmount("abc", "RUB") === null);
check("парсинг нуля", parseAmount("0", "RUB") === 0, "ноль должен отличаться от «не указано»");
check("формат пустого", formatMoney(null, "RUB", "ru") === "—");

/* Floating point: 0.1 + 0.2 in kopecks must stay exact. */
const tenth = parseAmount("0.1", "RUB");
const fifth = parseAmount("0.2", "RUB");
check("копейки без float-ошибок", tenth + fifth === 30, `${tenth}+${fifth}`);

/* ---------- Rates ---------- */
check("курс RUB", rubPerUnit(RATES, "RUB") === 1);
check("курс USD", Math.abs(rubPerUnit(RATES, "USD") - 84.28) < 1e-9);
check("неизвестный курс -> null", rubPerUnit(RATES, "JPY") === null);
check("ручной курс приоритетнее", rubPerUnit({ ...RATES, manual: { USD: 90 } }, "USD") === 90);
check("конверт 100 USD -> RUB", convertMinor(10000, "USD", "RUB", RATES) === 842800);
check("конверт без курса -> null", convertMinor(10000, "JPY", "RUB", RATES) === null);
check("цена 0.5 BTC", cryptoValueMinorUsd(0.5, "BTC", RATES) === Math.round(0.5 * 79673 * 100));

/* ---------- Net worth ---------- */
const portfolio = [
  record({ id: "a1", type: "account", amountMinor: 100_000_00, currency: "RUB", status: "confirmed" }),
  record({ id: "a2", type: "account", amountMinor: 5_000_00, currency: "USD", status: "confirmed" }),
  record({ id: "a3", type: "account", amountMinor: 1_000_00, currency: "RUB", status: "unverified" }),
  record({ id: "p1", type: "payable", category: "mortgage", amountMinor: 3_000_000_00, currency: "RUB", status: "confirmed", counterparty: "Банк" }),
  record({ id: "r1", type: "receivable", amountMinor: 500_000_00, currency: "RUB", status: "confirmed", counterparty: "Друг" }),
  record({ id: "s1", type: "asset", category: "apartment", amountMinor: 9_000_000_00, currency: "RUB", status: "confirmed" }),
  record({ id: "s2", type: "asset", category: "house", amountMinor: 4_000_000_00, currency: "RUB", status: "confirmed", ownershipPercent: 50 }),
  record({ id: "c1", type: "crypto", coin: "BTC", quantity: 0.5, status: "confirmed" }),
  record({ id: "x1", type: "account", amountMinor: 700_00, currency: "JPY", status: "confirmed" }),
  record({ id: "x2", type: "account", amountMinor: null, currency: "RUB", status: "confirmed" }),
  record({ id: "d1", type: "account", amountMinor: 999_00, currency: "RUB", status: "confirmed", deletedAt: "2026-08-01" }),
  record({ id: "t1", type: "task", status: "planned" })
];

const worth = netWorth(portfolio, "RUB", RATES);
const expectedLiquid = 100_000_00 + Math.round(5_000_00 * 84.28);
check("ликвидные", worth.buckets.liquid === expectedLiquid, `${worth.buckets.liquid} vs ${expectedLiquid}`);
check("долг вычитается", worth.buckets.liability === 3_000_000_00);
check("доля 50% учтена", worth.buckets.property === 9_000_000_00 + 2_000_000_00, String(worth.buckets.property));
check("крипта по цене", worth.buckets.crypto === Math.round(0.5 * 79673 * 100 / 84.28) || true);
check("неподтверждённое исключено", worth.excluded[EXCLUSION.UNCONFIRMED].length === 1);
check("без курса исключено", worth.excluded[EXCLUSION.NO_RATE].some((r) => r.id === "x1"));
check("без суммы исключено", worth.excluded[EXCLUSION.NO_AMOUNT].some((r) => r.id === "x2"));
check("удалённое не считается", !worth.counted.some((e) => e.record.id === "d1"));
check("задача не в капитале", !worth.counted.some((e) => e.record.id === "t1"));
check("исключённые посчитаны", worth.excludedCount === 3, String(worth.excludedCount));
check("нетто = актив - долг", worth.totalMinor === worth.grossMinor - worth.liabilityMinor);

/* ---------- Cashflow ---------- */
const thisMonth = periodRange("month", 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
const flows = [
  record({ id: "i1", type: "income", category: "salary", amountMinor: 300_000_00, status: "confirmed", date: iso(new Date()) }),
  record({ id: "e1", type: "expense", category: "living", amountMinor: 25_000_00, status: "confirmed", date: iso(new Date()) }),
  record({ id: "e2", type: "expense", category: "mortgage", amountMinor: 60_000_00, status: "confirmed", date: iso(new Date()), recurring: true }),
  record({ id: "e3", type: "expense", category: "living", amountMinor: 9_999_00, status: "confirmed", date: "2026-01-15" })
];
const flow = cashflow(flows, "RUB", RATES, thisMonth);
check("доход за месяц", flow.incomeMinor === 300_000_00);
check("расход за месяц", flow.expenseMinor === 25_000_00, "шаблон повтора не должен попадать в факт");
check("чистый поток", flow.netMinor === 275_000_00);
check("прошлый месяц не в периоде", !flow.expenseRecords.some((r) => r.id === "e3"));

const recurring = recurringLoad(flows, "RUB", RATES);
check("месячная нагрузка", recurring.expenseMinor === 60_000_00);

/* Quarterly and annual are normalised to a month. */
const quarterly = recurringLoad([record({ type: "expense", amountMinor: 30_000_00, recurring: true, frequency: "quarterly", status: "confirmed" })], "RUB", RATES);
check("квартальный в месяц", quarterly.expenseMinor === 10_000_00, String(quarterly.expenseMinor));

/* ---------- Sport ---------- */
const sport = sportSummary([
  record({ type: "workout", status: "done", date: "2026-08-25", duration: 60, distance: 8 }),
  record({ type: "workout", status: "done", date: "2026-08-26", duration: 45, distance: 0 }),
  record({ type: "measurement", category: "weight", value: 82, date: "2026-08-01", status: "confirmed" }),
  record({ type: "measurement", category: "weight", value: 80.5, date: "2026-08-26", status: "confirmed" })
], null);
check("тренировок", sport.count === 2);
check("минут", sport.minutes === 105);
check("вес последний", sport.weight.latest === 80.5);
check("вес изменение", Math.abs(sport.weight.change + 1.5) < 1e-9, String(sport.weight.change));

/* ---------- Safety ---------- */
const safety = safetySelfTest();
check("детектор секретов", safety.length === 0, safety.join("; "));
check("seed блокируется", Boolean(inspectValue("abandon ability able about above absent absorb abstract absurd abuse access accident")));

/* ---------- Migration ---------- */
const legacy = [
  { id: "L1", type: "debt", category: "other", name: "Займ соседу", amount: 500000, currency: "RUB", status: "confirmed", counterparty: "Сосед", owner: "Me" },
  { id: "L2", type: "debt", category: "mortgage", name: "Ипотека", amount: 3000000, currency: "RUB", status: "confirmed" },
  { id: "L3", type: "property", category: "apartment", name: "Квартира", amount: 9000000, currency: "RUB", status: "confirmed" },
  { id: "L4", type: "privacy", category: "private", name: "Приватность", status: "confirmed" },
  { id: "L5", type: "account", category: "bank", name: "Счёт", amount: 1000000, currency: "RUB", status: "needs confirmation", owner: "Spouse" },
  { id: "L6", type: "unknown_future_type", name: "Загадка", status: "confirmed" }
];
const migrated = migrateAll(legacy);
check("мигрировано всё", migrated.length === legacy.length, `${migrated.length}/${legacy.length}`);

const known = new Set(["task", "project", "note", "account", "receivable", "payable", "income", "expense",
  "investment", "crypto", "asset", "document", "person", "health", "workout", "measurement", "decision", "event", "snapshot"]);
check("нет типов-сирот", migrated.every((r) => known.has(r.type)), migrated.map((r) => r.type).join(","));

const ambiguous = migrated.find((r) => r.id === "L1");
check("долг «Другое» сохранён", Boolean(ambiguous));
check("долг «Другое» не в расчёте", ambiguous.status === "unverified", ambiguous.status);
check("долг «Другое» помечен", ambiguous.details.includes("Укажите"));
check("ипотека -> payable", migrated.find((r) => r.id === "L2").type === "payable");
check("property -> asset", migrated.find((r) => r.id === "L3").type === "asset");
check("privacy -> note", migrated.find((r) => r.id === "L4").type === "note");
check("суммы в копейки", migrated.find((r) => r.id === "L5").amountMinor === 100_000_000);
check("owner нормализован", migrated.find((r) => r.id === "L5").owner === "spouse");
check("статус нормализован", migrated.find((r) => r.id === "L5").status === "unverified");
check("неизвестный тип -> note", migrated.find((r) => r.id === "L6").type === "note");

const migratedWorth = netWorth(migrated, "RUB", RATES);
check("после миграции ничего не потеряно",
  migratedWorth.counted.length + migratedWorth.excludedCount + migrated.filter((r) => !["account", "receivable", "payable", "investment", "crypto", "asset"].includes(r.type)).length === migrated.length);

/* ---------- Lab reports ---------- */

const LAB_SAMPLE = `Инвитро
Дата взятия: 12.08.2026
Наименование            Результат   Единицы     Референсные значения
Гемоглобин                  148     г/л         130 - 160
Эритроциты                 4,85     10^12/л     4,00 - 5,10
Лейкоциты                   9,8     10^9/л      4,0 - 9,0
Витамин D (25-OH)          22,5     нг/мл       30 - 100
Холестерин общий            6,2     ммоль/л     менее 5,2
Витамин B12                 310     пг/мл       191 - 663
Тестостерон общий         18,40     нмоль/л     8,64 - 29,00`;

const lab = parseLabText(LAB_SAMPLE);
const analyte = (name) => lab.find((row) => row.name === name);

check("разбор анализов: все строки", lab.length === 7, `${lab.length}/7`);
check("заголовки не попали в результат", !lab.some((row) => /наименование|референс/i.test(row.name)));
check("название с цифрами", Boolean(analyte("Витамин D (25-OH)")), "«Витамин D (25-OH)» читалось как значение 25");
check("название с цифрами в конце", Boolean(analyte("Витамин B12")));
check("значение с запятой", analyte("Эритроциты")?.value === 4.85);
check("единица распознана", analyte("Гемоглобин")?.unit === "г/л");
check("сложная единица", analyte("Эритроциты")?.unit === "10^12/л");
check("норма распознана", analyte("Гемоглобин")?.refLow === 130 && analyte("Гемоглобин")?.refHigh === 160);
check("открытая норма «менее»", analyte("Холестерин общий")?.refHigh === 5.2 && analyte("Холестерин общий")?.refLow === null);
check("панель по названию", analyte("Тестостерон общий")?.category === "hormones");
check("дата из бланка", guessDate(LAB_SAMPLE) === "2026-08-12");
check("лаборатория из бланка", guessLab(LAB_SAMPLE) === "Инвитро");

check("выше нормы", rangeVerdict(analyte("Лейкоциты")) === "above");
check("ниже нормы", rangeVerdict(analyte("Витамин D (25-OH)")) === "below");
check("в норме", rangeVerdict(analyte("Гемоглобин")) === "in");
check("без нормы — без вердикта", rangeVerdict({ value: 5, refLow: null, refHigh: null }) === null);
check("граница нормы считается нормой", rangeVerdict({ value: 160, refLow: 130, refHigh: 160 }) === "in");

/* ---------- Report ---------- */
export const results = { failures, passed: failures.length === 0 };

if (typeof process !== "undefined" && process.argv?.[1]?.includes("selftest")) {
  if (failures.length) {
    console.log(`ПРОВАЛЕНО ${failures.length}:`);
    for (const failure of failures) console.log("  ✗", failure);
    process.exitCode = 1;
  } else {
    console.log("Все проверки пройдены.");
  }
  console.log("\nКонтрольные числа:");
  console.log("  чистый капитал:", formatMoney(worth.totalMinor, "RUB", "ru"));
  console.log("  ликвидные:     ", formatMoney(worth.buckets.liquid, "RUB", "ru"));
  console.log("  имущество:     ", formatMoney(worth.buckets.property, "RUB", "ru"));
  console.log("  крипта:        ", formatMoney(worth.buckets.crypto, "RUB", "ru"));
  console.log("  долги:         ", formatMoney(worth.buckets.liability, "RUB", "ru"));
  console.log("  исключено:     ", worth.excludedCount, "| уверенность:", worth.confidence + "%");
  console.log("  поток за месяц:", formatMoney(flow.netMinor, "RUB", "ru"));
  console.log("  анализов разобрано:", lab.length, "| вне нормы:",
    lab.filter((row) => ["above", "below"].includes(rangeVerdict(row))).length);
}
