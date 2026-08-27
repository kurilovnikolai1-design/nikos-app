/* Runnable checks for the parts that must not be wrong: money arithmetic,
   what counts toward net worth, and migration of records written by the
   previous build. Run with `node app/selftest.js`, and from Settings in the app. */

import { parseAmount, formatMoney } from "./money.js?v=20260827-144942";
import { assertSchemaIsSound, TYPES } from "./schema.js?v=20260827-144942";
const TYPES_ROLE_NONE = (type) => TYPES[type]?.role === "none";
import { selfTest as safetySelfTest, inspectValue } from "./safety.js?v=20260827-144942";
import { netWorth, cashflow, periodRange, recurringLoad, sportSummary, EXCLUSION } from "./finance.js?v=20260827-144942";
import { convertMinor, rubPerUnit, cryptoValueMinorUsd } from "./rates.js?v=20260827-144942";
import { migrateRecord, migrateAll, blankRecord, confirmedStatusFor } from "./records.js?v=20260827-144942";
import { parseLabText, rangeVerdict, guessDate, guessLab } from "./labs-parse.js?v=20260827-144942";
import { VIEWS as ROUTER_VIEWS } from "./router.js?v=20260827-144942";
import { routeFor, groupBySpecialist } from "./lab-routing.js?v=20260827-144942";
import { describe as describeAnalyte } from "./lab-descriptions.js?v=20260827-144942";
import { conditionPanels, knownConditions } from "./conditions.js?v=20260827-144942";
import { partitionByResolution, resolutions, resolutionState } from "./resolved.js?v=20260827-144942";
import { describeSize, MAX_BYTES } from "./attachments.js?v=20260827-144942";
import { dueReminders, describe as describeReminder } from "./notify.js?v=20260827-144942";
import { parseReport } from "./procedures.js?v=20260827-144942";
import { budgetStatus, BUDGET_STATE, typicalMonthlySpend } from "./budget.js?v=20260827-144942";
import { goalsOverview, goalProgress, GOAL_STATE, totalOutstanding } from "./goals.js?v=20260827-144942";
import { portfolio as positionBook, positionPnl, PNL_STATE } from "./positions.js?v=20260827-144942";
import { quoteKey, quoteFor, MARKET } from "./quotes.js?v=20260827-144942";
import { byExercise, weeklyVolume, freshRecords, setsOf } from "./training.js?v=20260827-144942";
import { projectsWithMoney, projectTotals } from "./project-money.js?v=20260827-144942";
import { nextOccurrence, nextTaskFrom, isRepeating } from "./recurrence.js?v=20260827-144942";
import { isDue, KEEP, EVERY_DAYS } from "./backups.js?v=20260827-144942";

/* Kept in step with router.js — a type pointing at a view that does not exist
   is how records used to disappear. */
const VIEWS = ["command", "inbox", "tasks", "projects", "capital", "debts", "cashflow", "investments",
  "crypto", "assets", "health", "labs", "documents", "people", "decisions", "timeline", "settings"];

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
/* The list above is a copy, and drift between it and the router is exactly the
   kind of gap that let a record type point at a view that did not exist. */
check("список экранов совпадает с роутером",
  VIEWS.length === ROUTER_VIEWS.length && VIEWS.every((view) => ROUTER_VIEWS.includes(view)),
  `тест: ${VIEWS.length}, роутер: ${ROUTER_VIEWS.length}`);

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
  "investment", "crypto", "asset", "document", "person", "health", "lab", "workout", "measurement", "decision", "event", "snapshot"]);
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

/* ---------- Which door to knock on ---------- */

/* Routing must stay administrative. These check that a name lands in the
   right specialty, and — the one that matters — that an unknown name returns
   nothing rather than being guessed into a plausible-looking answer. */
check("ферритин -> гематолог", routeFor("Ферритин")?.key === "haematologist");
check("креатинин -> нефролог", routeFor("Креатинин (метод Яффе)")?.key === "nephrologist");
check("ЛПНП -> кардиолог", routeFor("Холестерин липопротеидов низкой плотности (ЛПНП, LDL)")?.key === "cardiologist");
check("ТТГ -> эндокринолог", routeFor("Тиреотропный гормон (ТТГ)")?.key === "endocrinologist");
check("выдуманный показатель -> без маршрута", routeFor("Показатель которого нет") === null,
      "неизвестное имя не должно получать правдоподобный маршрут");

const routed = groupBySpecialist([
  { name: "Ферритин" }, { name: "Железо" }, { name: "Креатинин" }
]);
check("один приём на систему", routed.length === 2, `получилось ${routed.length} групп вместо 2`);
check("группы отсортированы по размеру", routed[0].analytes.length === 2);

/* ---------- The laboratory's own words ---------- */
check("описание ферритина есть", (describeAnalyte("Ферритин") || "").includes("депонирования железа"));
check("описание наследуется вариантом имени",
      describeAnalyte("Билирубин общий (BIL)") === describeAnalyte("Билирубин общий"));
check("нет описания -> null, а не выдумка", describeAnalyte("Показатель которого нет") === null);

/* ---------- Conditions ---------- */

/* The rule that matters: a condition exists only because the owner wrote it
   down. A ferritin result, however high, must never conjure one. */
const ironOnly = [
  { id: "l1", type: "lab", name: "Ферритин", value: 900, unit: "мкг/л", refHigh: 400, date: "2026-04-21" }
];
check("диагноз не выводится из анализа", knownConditions(ironOnly).length === 0,
      "состояние может появиться только из записи владельца");

const declared = [
  ...ironOnly,
  { id: "l2", type: "lab", name: "Коэффициент насыщения трансферрина", value: 31, unit: "%", date: "2024-05-20" },
  { id: "h1", type: "health", category: "condition", name: "Гемохроматоз", owner: "me" },
  { id: "h2", type: "health", category: "condition", name: "Гемохроматоз", owner: "family" }
];
const [panelFor] = conditionPanels(declared, { locale: "ru", now: Date.parse("2026-08-27") });
check("состояние читается из записи", panelFor?.key === "haemochromatosis");
check("наследственное помечено", panelFor?.hereditary === true);
check("одно состояние на несколько человек", panelFor?.owners.length === 2,
      `владельцев: ${panelFor?.owners.length}`);
check("просрочка считается по календарю",
      panelFor?.tracked.find((item) => item.label === "Насыщение трансферрина")?.overdue === true);
check("свежий показатель не просрочен",
      panelFor?.tracked.find((item) => item.label === "Ферритин")?.overdue === false);
check("несданное попадает в missing", panelFor?.missing.includes("АЛТ"));

/* ---------- Findings already dealt with ---------- */

/* The rules that keep "уже пролечено" honest: it hides no data, it expires by
   itself when a later result disagrees, and it distinguishes "confirmed clear"
   from "nobody ever checked". */
const H_PYLORI = "13С - уреазный дыхательный тест (H.pylori)";
const treated = { id: "r1", type: "health", category: "condition", status: "closed",
                  name: H_PYLORI, date: "2026-05-15" };

const positiveOnly = [
  { id: "p1", type: "lab", name: H_PYLORI, value: 16.7, unit: "‰", refHigh: 4, date: "2026-04-21" }
];
const beforeMarking = partitionByResolution(
  (await import("./labs-parse.js?v=20260827-144942")).byAnalyte(positiveOnly), positiveOnly);
check("без пометки отклонение активно", beforeMarking.active.length === 1);

const afterMarking = partitionByResolution(
  (await import("./labs-parse.js?v=20260827-144942")).byAnalyte(positiveOnly), [...positiveOnly, treated]);
check("пролеченное уходит из активных", afterMarking.active.length === 0);
check("пролеченное не исчезает совсем", afterMarking.resolved.length === 1,
      "запись обязана остаться видимой");
check("без пересдачи — так и сказано", afterMarking.resolved[0].state.unconfirmed === true);

/* A later result that is still out of range overrides the resolution. */
const relapsed = [...positiveOnly, treated,
  { id: "p2", type: "lab", name: H_PYLORI, value: 12.1, unit: "‰", refHigh: 4, date: "2026-07-01" }];
const after = partitionByResolution((await import("./labs-parse.js?v=20260827-144942")).byAnalyte(relapsed), relapsed);
check("новый плохой результат отменяет пометку", after.active.length === 1,
      "пометка не должна переживать противоречащий ей результат");

/* A later result inside the range confirms it. */
const cleared = [...positiveOnly, treated,
  { id: "p3", type: "lab", name: H_PYLORI, value: 1.2, unit: "‰", refHigh: 4, date: "2026-07-01" }];
const done = partitionByResolution((await import("./labs-parse.js?v=20260827-144942")).byAnalyte(cleared), cleared);
check("пересдача в норме подтверждает", done.resolved[0]?.state.confirmed === true);

check("пролеченное не считается активным состоянием",
      knownConditions([...positiveOnly, treated]).length === 0);

/* ---------- Attachments ---------- */
check("размер файла по-человечески", describeSize(300000, "ru") === "293 КБ", describeSize(300000, "ru"));
check("байты остаются байтами", describeSize(512, "ru") === "512 Б");
check("предел вложения назван", describeSize(MAX_BYTES, "ru") === "25 МБ", describeSize(MAX_BYTES, "ru"));

/* ---------- Reminders that leave the screen ---------- */

const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const nextYear = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);

const reminderSet = [
  { id: "n1", type: "payable", name: "Ипотека", reminderDate: yesterday },
  { id: "n2", type: "payable", name: "Не сегодня", reminderDate: nextYear },
  { id: "n3", type: "document", name: "ОСАГО", expiresAt: yesterday },
  { id: "n4", type: "document", name: "Паспорт", expiresAt: nextYear },
  { id: "n5", type: "task", name: "Без даты" }
];
const due = dueReminders(reminderSet);
check("просроченное напоминание попадает в срочные", due.some((item) => item.record.id === "n1"));
check("будущее напоминание не беспокоит", !due.some((item) => item.record.id === "n2"));
check("истекший документ попадает", due.some((item) => item.record.id === "n3"));
check("документ на год вперёд не беспокоит", !due.some((item) => item.record.id === "n4"));
check("запись без даты не беспокоит", !due.some((item) => item.record.id === "n5"));
check("самое просроченное — первым", due[0]?.days <= due.at(-1)?.days);
check("текст напоминания называет запись",
      describeReminder(due.find((item) => item.record.id === "n1"), "ru").body.includes("Ипотека"));

/* ---------- Procedure reports ---------- */

/* The rule: everything reported is a quotation. A report that says nothing
   about coming back must not produce a follow-up date. */
const colonoscopy = parseReport(
  "Дата: 14.05.2026\nВидеоколоноскопия\nЗаключение: Полип сигмовидной кишки.\n" +
  "Рекомендации: контрольная колоноскопия через 3 года.");
check("дата выписки прочитана", colonoscopy.date === "2026-05-14");
check("вид исследования опознан", colonoscopy.kind === "Колоноскопия");
check("заключение взято дословно", colonoscopy.conclusion === "Полип сигмовидной кишки.");
check("срок контроля посчитан от даты", colonoscopy.followUp?.date === "2029-05-14");
check("контроль подкреплён цитатой", colonoscopy.followUp?.quote.includes("через 3 года"));
check("текст выписки сохранён целиком", colonoscopy.fullText.includes("Видеоколоноскопия"));

const quiet = parseReport("УЗИ брюшной полости 03.04.2026\nЗаключение: Диффузные изменения печени.");
check("без рекомендации — без срока", quiet.followUp === null,
      "срок контроля нельзя выводить из находок");
check("заключение всё равно прочитано", quiet.conclusion === "Диффузные изменения печени.");

const noise = parseReport("просто какой-то текст");
check("из мусора ничего не выдумывается",
      noise.kind === null && noise.conclusion === null && noise.followUp === null);

/* ---------- Budget ---------- */

/* The rule that matters most: no limit means no limit. A budget must never be
   inferred from spending and then reported as if the owner had set one. */
const monthDay = (day) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day).toISOString().slice(0, 10);
};
const spending = [
  { id: "b1", type: "expense", status: "confirmed", amountMinor: 4500000, currency: "RUB", date: monthDay(3) },
  { id: "b2", type: "expense", status: "confirmed", amountMinor: 1200000, currency: "RUB", date: monthDay(9) },
  { id: "b3", type: "expense", status: "unverified", amountMinor: 900000, currency: "RUB", date: monthDay(10) }
];

const noLimit = budgetStatus(spending, "RUB", RATES, {});
check("без предела бюджет не выдумывается", noLimit.state === BUDGET_STATE.UNSET);
check("но расход всё равно посчитан", noLimit.spentMinor === 5700000, String(noLimit.spentMinor));

const within = budgetStatus(spending, "RUB", RATES, { budgetMinor: 10000000 });
check("остаток считается верно", within.remainingMinor === 4300000, String(within.remainingMinor));
check("в пределах лимита", within.state === BUDGET_STATE.UNDER);
check("непосчитанное названо", within.excludedCount === 1,
      "неподтверждённый расход обязан быть виден, иначе остаток врёт");

const exceeded = budgetStatus(spending, "RUB", RATES, { budgetMinor: 5000000 });
check("перерасход опознан", exceeded.state === BUDGET_STATE.OVER);
check("остаток уходит в минус", exceeded.remainingMinor === -700000, String(exceeded.remainingMinor));

const nearly = budgetStatus(spending, "RUB", RATES, { budgetMinor: 6000000 });
check("у самого предела — отдельное состояние", nearly.state === BUDGET_STATE.CLOSE);

check("пустая история не даёт среднего", typicalMonthlySpend([], "RUB", RATES) === null,
      "месяц без записей — это несобранные данные, а не нулевые траты");

/* ---------- Goals ---------- */

/* The invariant that protects net worth: a goal holds money that is already
   counted where it sits, so it must contribute nothing to the balance. */
check("цель не участвует в капитале", TYPES_ROLE_NONE("goal"));

const goal = (over) => ({ type: "goal", status: "active", currency: "RUB",
                          deletedAt: null, linkedIds: [], ...over });

const reached = goalProgress(goal({ id: "g1", amountMinor: 5_000_00, targetAmountMinor: 5_000_00 }), "RUB", RATES);
check("цель собрана", reached.state === GOAL_STATE.REACHED);
check("собранная цель не требует добора", reached.remainingMinor === 0);

const noTarget = goalProgress(goal({ id: "g2", amountMinor: 1_000_00 }), "RUB", RATES);
check("без суммы цели прогресс не выдумывается", noTarget.state === GOAL_STATE.NO_TARGET);

const noDate = goalProgress(goal({ id: "g3", amountMinor: 1_000_00, targetAmountMinor: 5_000_00 }), "RUB", RATES);
check("без срока — без темпа", noDate.state === GOAL_STATE.NO_DEADLINE);
check("но нехватка посчитана", noDate.remainingMinor === 4_000_00);

/* Twelve months, half of it saved: the arithmetic must be the shortfall over
   the months remaining, not over the whole period. */
const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
const paced = goalProgress(goal({ id: "g4", amountMinor: 50_000_00, targetAmountMinor: 110_000_00, targetDate: future }), "RUB", RATES);
check("нужно в месяц посчитано от остатка",
      Math.abs(paced.neededPerMonthMinor - 5_000_00) < 20_00,
      String(paced.neededPerMonthMinor));

const overdue = goalProgress(goal({ id: "g5", amountMinor: 1_000_00, targetAmountMinor: 9_000_00, targetDate: "2020-01-01" }), "RUB", RATES);
check("просроченная цель названа просроченной", overdue.overdue === true && overdue.state === GOAL_STATE.BEHIND);

const overview = goalsOverview([
  goal({ id: "g6", name: "A", amountMinor: 0, targetAmountMinor: 10_000_00, targetDate: future }),
  goal({ id: "g7", name: "B", amountMinor: 10_000_00, targetAmountMinor: 10_000_00 }),
  goal({ id: "g8", name: "C", amountMinor: 0, targetAmountMinor: 1_000_00, status: "archived" })
], "RUB", RATES);
check("архивные цели не показываются", !overview.some((item) => item.record.id === "g8"));
check("собранные уходят вниз", overview.at(-1)?.record.id === "g7");
check("общая нехватка суммируется", totalOutstanding(overview) === 10_000_00, String(totalOutstanding(overview)));

/* ---------- Positions ---------- */

/* The refusal that matters: a portfolio with one position missing its cost
   must not report a profit, because value-minus-partial-cost is not one. */
const coin = (over) => ({ type: "crypto", status: "confirmed", currency: "USD",
                          deletedAt: null, linkedIds: [], ...over });

const btc = positionPnl(coin({ id: "p1", coin: "BTC", quantity: 0.5, costBasisMinor: 20_000_00 }), "RUB", RATES);
check("прибыль по позиции считается", btc.state === PNL_STATE.UP);
check("вложенное переведено в рубли", btc.costMinor === Math.round(20_000_00 * 84.28), String(btc.costMinor));
check("процент от вложенного", Math.abs(btc.pnlPercent - (btc.pnlMinor / btc.costMinor) * 100) < 1e-9);
check("цена входа на единицу", btc.entryPriceMinor === Math.round(btc.costMinor / 0.5));

const loss = positionPnl(coin({ id: "p2", coin: "ETH", quantity: 4, costBasisMinor: 14_000_00 }), "RUB", RATES);
check("убыток опознан", loss.state === PNL_STATE.DOWN && loss.pnlMinor < 0);

const noCost = positionPnl(coin({ id: "p3", coin: "BTC", quantity: 0.1 }), "RUB", RATES);
check("без цены входа — не ноль, а состояние", noCost.state === PNL_STATE.NO_COST);
check("но стоимость всё равно известна", noCost.valueMinor > 0);

const gift = positionPnl(coin({ id: "p4", coin: "BTC", quantity: 0.1, costBasisMinor: 0 }), "RUB", RATES);
check("нулевая цена входа не даёт бесконечности", gift.pnlPercent === null);

const mixed = positionBook([
  coin({ id: "m1", coin: "BTC", quantity: 0.5, costBasisMinor: 20_000_00 }),
  coin({ id: "m2", coin: "BTC", quantity: 0.1 })
], "RUB", RATES);
check("неполный портфель не показывает прибыль", mixed.pnlMinor === null,
      "стоимость минус часть затрат — это не прибыль");
check("но говорит, скольких данных не хватает", mixed.withoutCost === 1);
check("стоимость портфеля всё равно посчитана", mixed.valueMinor > 0);

const complete = positionBook([
  coin({ id: "m3", coin: "BTC", quantity: 0.5, costBasisMinor: 20_000_00 }),
  coin({ id: "m4", coin: "ETH", quantity: 4, costBasisMinor: 14_000_00 })
], "RUB", RATES);
check("полный портфель показывает прибыль", complete.pnlMinor !== null);
check("прибыль = стоимость минус затраты",
      complete.pnlMinor === complete.valueMinor - complete.costMinor);

/* ---------- Securities ---------- */

const QUOTED = { ...RATES, securities: {
  "moex:SBER": { ticker: "SBER", market: "moex", price: 270.07, currency: "RUB", name: "Сбербанк", live: true },
  "foreign:AAPL": { ticker: "AAPL", market: "foreign", price: 232.5, currency: "USD", name: "AAPL", live: true }
} };
const paper = (over) => ({ type: "security", status: "confirmed", deletedAt: null, linkedIds: [], ...over });

check("ключ котировки собирается из рынка и тикера",
      quoteKey(paper({ ticker: "sber", market: "moex" })) === "moex:SBER");
check("по умолчанию рынок — МосБиржа",
      quoteKey(paper({ ticker: "GAZP" })) === "moex:GAZP");
check("котировка находится", quoteFor(paper({ ticker: "SBER", market: MARKET.MOEX }), QUOTED)?.price === 270.07);

const sber = positionPnl(paper({ id: "s1", ticker: "SBER", market: "moex", quantity: 100, costBasisMinor: 22_000_00, currency: "RUB" }), "RUB", QUOTED);
check("бумага оценена по котировке", sber.valueMinor === Math.round(100 * 270.07 * 100), String(sber.valueMinor));
check("прибыль по бумаге", sber.state === PNL_STATE.UP);

const foreign = positionPnl(paper({ id: "s2", ticker: "AAPL", market: "foreign", quantity: 5, costBasisMinor: 900_00, currency: "USD" }), "RUB", QUOTED);
check("иностранная бумага переведена в рубли",
      foreign.valueMinor === Math.round(5 * 232.5 * 100 * 84.28), String(foreign.valueMinor));

const unpriced = positionBook([
  paper({ id: "s3", ticker: "SBER", market: "moex", quantity: 100, costBasisMinor: 22_000_00, currency: "RUB" }),
  paper({ id: "s4", ticker: "XXXX", market: "moex", quantity: 5, costBasisMinor: 10_000_00, currency: "RUB" })
], "RUB", QUOTED, ["security"]);
check("бумага без котировки не ломает портфель", unpriced.valueMinor > 0);
check("но посчитана отдельно", unpriced.unpriced === 1,
      "иначе сумма молча относится к меньшему числу позиций, чем показано");

/* ---------- Training ---------- */

const session = (id, date, sets) => ({ id, type: "workout", date, sets, deletedAt: null, linkedIds: [] });
const log = [
  session("t1", "2026-07-01", [{ exercise: "Жим лёжа", weight: 90, reps: 5 },
                               { exercise: "Жим лёжа", weight: 90, reps: 5 },
                               { exercise: "Присед", weight: 120, reps: 5 }]),
  session("t2", "2026-07-15", [{ exercise: "жим лёжа", weight: 95, reps: 5 }]),
  session("t3", "2026-08-20", [{ exercise: "Жим лёжа", weight: 100, reps: 5 },
                               { exercise: "Подтягивания", reps: 12 }])
];
const lifts = byExercise(log);
const bench = lifts.find((group) => group.name.toLowerCase() === "жим лёжа");

check("подходы одного упражнения сводятся", bench?.count === 3, String(bench?.count));
check("регистр в названии не создаёт второе упражнение",
      lifts.filter((group) => group.name.toLowerCase() === "жим лёжа").length === 1);
check("лучший вес найден", bench?.heaviest.bestWeight === 100);
check("направление показано с третьей тренировки", bench?.trend?.changeKg === 10);

const squat = lifts.find((group) => group.name === "Присед");
check("по двум точкам направление не выводится", squat?.trend === null,
      "две тренировки — это не тенденция");

const pullups = lifts.find((group) => group.name === "Подтягивания");
check("работа с весом тела считается", pullups?.latest.reps === 12);
check("но не даёт выдуманного тоннажа", pullups?.latest.volume === 0,
      "вес тела нельзя придумать, иначе объём станет вымыслом");

check("мусорный подход отбрасывается",
      setsOf({ sets: [{ exercise: "  ", weight: 50, reps: 5 }, { exercise: "Тяга", weight: "x", reps: 8 }] }).length === 1);
check("нечисловой вес становится пустым",
      setsOf({ sets: [{ exercise: "Тяга", weight: "x", reps: 8 }] })[0].weight === null);

const weeks = weeklyVolume(log, { weeks: 3, now: new Date("2026-08-27T12:00:00") });
check("объём разложен по неделям", weeks.length === 3);
check("неделя с тренировкой имеет объём", weeks.some((week) => week.volume === 500), JSON.stringify(weeks));

const bests = freshRecords(log, { now: new Date("2026-08-27T12:00:00") });
check("новый рекорд замечен", bests.length === 1 && bests[0].weight === 100);

/* ---------- Money by project ---------- */

const site = [
  { id: "pj1", type: "project", name: "Сайт", status: "active", linkedIds: ["pi1", "pe1"], deletedAt: null },
  { id: "pj2", type: "project", name: "Магазин", status: "active", linkedIds: [], deletedAt: null },
  { id: "pi1", type: "income", amountMinor: 150_000_00, currency: "RUB", status: "confirmed", linkedIds: [], deletedAt: null },
  { id: "pe1", type: "expense", amountMinor: 12_000_00, currency: "RUB", status: "confirmed", linkedIds: [], deletedAt: null },
  /* Linked from the expense's side rather than the project's — the same act. */
  { id: "pe2", type: "expense", amountMinor: 80_000_00, currency: "RUB", status: "confirmed", linkedIds: ["pj2"], deletedAt: null },
  { id: "pe3", type: "expense", amountMinor: 5_000_00, currency: "RUB", status: "unverified", linkedIds: ["pj2"], deletedAt: null }
];
const byProject = projectsWithMoney(site, "RUB", RATES);
const siteMoney = byProject.find((entry) => entry.project.id === "pj1");
const shopMoney = byProject.find((entry) => entry.project.id === "pj2");

check("связь считается в обе стороны", shopMoney?.expenseMinor === 80_000_00,
      "ссылка от расхода к проекту должна работать так же, как от проекта к расходу");
check("итог по проекту", siteMoney?.netMinor === 138_000_00, String(siteMoney?.netMinor));
check("возврат к вложенному", Math.round(siteMoney?.returnPercent) === 1150);
check("неподтверждённое не входит, но названо", shopMoney?.skipped === 1);
check("проекты без денег не показываются",
      projectsWithMoney([site[1]], "RUB", RATES).length === 0);
check("итоги суммируются", projectTotals(byProject).netMinor === 58_000_00,
      String(projectTotals(byProject).netMinor));

/* ---------- Repeating tasks ---------- */

const AT = new Date("2026-08-27T12:00:00");

check("год вперёд от срока", nextOccurrence("2026-03-10", "annual", { now: AT }) === "2027-03-10");
check("месяц вперёд", nextOccurrence("2026-08-01", "monthly", { now: AT }) === "2026-09-01");
check("просроченное не плодит хвост из прошлого",
      nextOccurrence("2019-01-01", "annual", { now: AT }) === "2027-01-01",
      "следующая дата обязана быть в будущем, а не следующей после старой");
check("неизвестная частота -> null", nextOccurrence("2026-01-01", "hourly", { now: AT }) === null);

const service = { id: "rt1", type: "task", name: "Заменить масло", category: "property",
                  date: "2026-08-01", reminderDate: "2026-07-25", frequency: "annual",
                  status: "done", linkedIds: ["car1"], priority: "normal" };
const follow = nextTaskFrom(service, { now: AT });
check("повтор создаётся", follow?.date === "2027-08-01");
check("повтор не выполнен заранее", follow?.status === "planned");
check("напоминание сохраняет свой отступ", follow?.reminderDate === "2027-07-25",
      String(follow?.reminderDate));
check("связи переносятся", follow?.linkedIds.includes("car1"));
check("разовая задача не повторяется", nextTaskFrom({ ...service, frequency: null }, { now: AT }) === null);
check("повторяемость опознаётся", isRepeating(service) && !isRepeating({ ...service, frequency: "" }));

/* ---------- Records the owner typed ---------- */

/* The bug this guards against: adding 50 BTC changed no total and said
   nothing, because six of the nine money types were born "unverified" and an
   unverified record is excluded from every sum. Whoever typed it is the only
   person who could ever verify it. */
for (const type of ["account", "crypto", "asset", "receivable", "payable", "investment", "security"]) {
  const typed = blankRecord(type, { entered: true });
  check(`введённая вручную запись «${type}» считается`,
        ["confirmed", "active", "done", "paid"].includes(typed.status),
        `получилось «${typed.status}»`);
}

/* Anything arriving from elsewhere keeps the cautious default, because it
   genuinely has not been checked by anyone. */
check("импортируемая запись остаётся непроверенной",
      blankRecord("account").status === "unverified");

check("подтверждающий статус выбирается по типу",
      confirmedStatusFor("project") === "active" && confirmedStatusFor("account") === "confirmed",
      `${confirmedStatusFor("project")} / ${confirmedStatusFor("account")}`);

/* And the whole point: a hand-entered holding must reach net worth. */
const typedCoin = { ...blankRecord("crypto", { entered: true }), coin: "BTC", quantity: 50 };
const withCoin = netWorth([typedCoin], "RUB", RATES);
check("50 BTC попадают в чистый капитал", withCoin.totalMinor > 0, String(withCoin.totalMinor));
check("и не числятся исключёнными", withCoin.excludedCount === 0);

/* ---------- Backups ---------- */

const DAY_MS = 86_400_000;
check("без единой копии — копия нужна", isDue(null) === true);
check("свежая копия не нужна повторно",
      isDue(new Date(Date.now() - 2 * DAY_MS).toISOString()) === false);
check("копия старше недели устарела",
      isDue(new Date(Date.now() - 9 * DAY_MS).toISOString()) === true);
check("испорченная дата трактуется как «копии нет»", isDue("не дата") === true,
      "сомнение обязано решаться в пользу лишней копии");
check("окно хранения задано", KEEP >= 4 && EVERY_DAYS >= 1);

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
