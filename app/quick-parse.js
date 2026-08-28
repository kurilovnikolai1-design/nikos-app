/* One line in, a filled-in record out.
 *
 * Six taps to log a coffee is five too many, and an app that costs six taps
 * stops being used for small things — which is most things. Typing "бензин
 * 3500" should be enough, because it already contains everything the record
 * needs.
 *
 * What it reads: an amount, a date, a currency, and a type implied by the
 * wording. What it will not do is guess: anything it did not recognise is
 * left empty and the form opens with the rest filled in, so a wrong reading
 * is visible before it is saved rather than discovered months later in a
 * total.
 *
 * The record is never saved silently. The whole point is speed, and speed
 * that produces records nobody checked is how a ledger becomes untrustworthy. */

import { parseAmount } from "./money.js?v=20260828-003727";
import { localDate } from "./dates.js?v=20260828-003727";

const DAY = 86_400_000;

/* Money arriving rather than leaving. Checked first, because "получил 50000"
   and "потратил 50000" differ only in the verb. */
const INCOME_WORDS = /(получил|пришл|поступил|заплатили|зарплат|аванс|доход|продал|вернул[аи]?\s|дивиденд|проценты)/i;
const EXPENSE_WORDS = /(потратил|купил|оплатил|заплатил|списал|расход|заправил)/i;
const TASK_WORDS = /(надо|нужно|не забыть|позвонить|записаться|сделать|напомнить|съездить|отправить|уточнить)/i;
const WORKOUT_WORDS = /(тренировк|зал|пробежал|бег|плавал|велосипед|турник|жим|присед|становая)/i;
const MEASURE_WORDS = /(вес|давление|пульс|сон|спал|шаг)/i;

/* Categories only where the word leaves no room for doubt. */
const CATEGORY_WORDS = [
  { re: /(бензин|заправ|азс|топлив|такси|парковк|каршеринг|шиномонтаж|то\b)/i, type: "expense", category: "transport" },
  { re: /(продукт|магазин|пятёрочк|пятерочк|магнит|перекрёсток|перекресток|лента|вкусвилл|кафе|ресторан|обед)/i, type: "expense", category: "living" },
  { re: /(жкх|коммуналк|электрич|вода|газ|интернет|квартплат)/i, type: "expense", category: "housing" },
  { re: /(ипотек)/i, type: "expense", category: "mortgage" },
  { re: /(страховк|осаго|каско|полис)/i, type: "expense", category: "insurance" },
  { re: /(аптек|врач|клиник|анализ|стоматолог|лечен)/i, type: "expense", category: "health" },
  { re: /(подписк|яндекс плюс|netflix|spotify)/i, type: "expense", category: "subscription" },
  { re: /(налог|ндфл|патент)/i, type: "expense", category: "tax" },
  { re: /(зарплат|аванс|оклад)/i, type: "income", category: "salary" },
  { re: /(аренд|съём|сдал)/i, type: "income", category: "rent" },
  { re: /(дивиденд)/i, type: "income", category: "dividend" },
  { re: /(процент|купон|вклад)/i, type: "income", category: "interest" }
];

/* \b is ASCII-only, so /\bвчера\b/ never matched a Cyrillic word at the end of
   a line: the date was silently ignored and the word stayed in the name.
   Longest first, or "позавчера" matches as "вчера". */
const edge = (word) => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "iu");

const RELATIVE_DATES = [
  { re: edge("позавчера"), days: -2 },
  { re: edge("послезавтра"), days: 2 },
  { re: edge("вчера"), days: -1 },
  { re: edge("сегодня"), days: 0 },
  { re: edge("завтра"), days: 1 }
];

const MONTHS = ["январ", "феврал", "март", "апрел", "мая|май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

function findDate(text, now) {
  for (const entry of RELATIVE_DATES) {
    if (entry.re.test(text)) {
      const date = new Date(now.getTime() + entry.days * DAY);
      return { date: localDate(date), matched: entry.re };
    }
  }

  const numeric = /\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = numeric[3]
        ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]))
        : now.getFullYear();
      return {
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        matched: new RegExp(numeric[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      };
    }
  }

  /* \w matches no Cyrillic, so "20 августа" was struck from the text as
     "20 август" and left a stray "а" behind in the name. */
  const written = new RegExp(`(\\d{1,2})\\s+(${MONTHS.join("|")})\\p{L}*`, "iu").exec(text);
  if (written) {
    const index = MONTHS.findIndex((stem) => new RegExp(`^(${stem})`, "i").test(written[2]));
    if (index >= 0) {
      return {
        date: `${now.getFullYear()}-${String(index + 1).padStart(2, "0")}-${String(written[1]).padStart(2, "0")}`,
        matched: new RegExp(written[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      };
    }
  }

  return null;
}

/* One number at a time, not a greedy run of them: a pattern that allowed
   spaces and dots freely read "180000 25.08" as a single amount of
   18 000 025,08. A space counts as a thousands separator only when exactly
   three digits follow it. */
const NUMBER = /-?\d{1,3}(?:[   ]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/g;
const SUFFIX = /^\s*(₽|руб\.?|р\.?|\$|usd|eur|€|к|k|тыс\.?|млн|м)(?!\p{L})/iu;

/* A multiplier changes the value and has to reach parseAmount; a currency mark
   only says which currency and would make parseAmount fail. */
const MULTIPLIER = /^(к|k|тыс\.?|млн|м)$/i;

/* The last number that reads as money. Last, because "бензин 95 3500" means
   three and a half thousand roubles of ninety-five octane. */
function findAmount(text, currency) {
  const candidates = [...text.matchAll(NUMBER)].map((match) => {
    const suffix = SUFFIX.exec(text.slice(match.index + match[0].length));
    const tail = suffix ? suffix[1] : "";
    return {
      /* What to strike from the name: the number and whatever followed it. */
      raw: match[0] + (suffix ? suffix[0] : ""),
      /* What to hand to parseAmount: the number, plus a multiplier if there
         was one. A currency mark is not part of the value. */
      value: match[0] + (MULTIPLIER.test(tail) ? tail : ""),
      index: match.index,
      hasSuffix: Boolean(suffix)
    };
  });

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const entry = candidates[index];
    /* A bare one- or two-digit number is more often a quantity than a price
       ("жим 100 на 5"), so it only counts when it carries a currency or a
       multiplier. */
    if (/^-?\d{1,2}$/.test(entry.value) && !entry.hasSuffix) continue;
    const minor = parseAmount(entry.value, currency);
    if (minor !== null && minor !== 0) return { minor, raw: entry.raw, index: entry.index };
  }
  return null;
}

const CURRENCIES = [
  { re: /(\$|usd|доллар)/i, code: "USD" },
  { re: /(€|eur|евро)/i, code: "EUR" },
  { re: /(¥|cny|юан)/i, code: "CNY" }
];

export function parseQuick(text, { base = "RUB", now = new Date() } = {}) {
  const input = String(text || "").trim();
  if (!input) return null;

  const currency = CURRENCIES.find((entry) => entry.re.test(input))?.code || base;

  /* The date comes out of the text first. "25.08" and "20 августа" both look
     like numbers, and leaving them in let the amount parser read the date as
     part of the price. */
  const when = findDate(input, now);
  const withoutDate = when?.matched ? input.replace(when.matched, " ") : input;
  const amount = findAmount(withoutDate, currency);

  const category = CATEGORY_WORDS.find((entry) => entry.re.test(input)) || null;

  /* Type: an explicit verb wins, then a category's own type, then the shape of
     what was written — something with a price is a purchase, something without
     one is a thought. */
  let type;
  if (TASK_WORDS.test(input) && !amount) type = "task";
  else if (WORKOUT_WORDS.test(input)) type = "workout";
  else if (INCOME_WORDS.test(input)) type = "income";
  else if (EXPENSE_WORDS.test(input)) type = "expense";
  else if (category) type = category.type;
  else if (MEASURE_WORDS.test(input) && amount) type = "measurement";
  else if (amount) type = "expense";
  else type = "note";

  /* The name is what is left once the machinery has been taken out. */
  let name = withoutDate;
  if (amount) name = name.replace(amount.raw, " ");
  name = name
    .replace(/(₽|руб\.?|р\.|\$|usd|eur|€)/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.–—-]+|[\s,.–—-]+$/g, "")
    .trim();

  const draft = {
    type,
    name: name || input.slice(0, 80),
    date: when?.date || localDate(now)
  };

  if (category) draft.category = category.category;
  if (amount && ["expense", "income"].includes(type)) {
    draft.amountMinor = Math.abs(amount.minor);
    draft.currency = currency;
  }
  if (amount && type === "measurement") draft.value = Math.abs(amount.minor) / 100;
  if (type === "note") draft.details = input;

  return {
    draft,
    /* What was actually recognised, so the dialog can show it rather than
       leaving the owner to spot a misreading in a total three months later. */
    read: {
      type,
      amount: amount ? Math.abs(amount.minor) : null,
      currency: amount ? currency : null,
      date: when?.date || null,
      category: category?.category || null
    }
  };
}

export const QUICK_NOTE = {
  ru: "Что не распозналось — останется пустым: Nik'Os не угадывает. Форма откроется заполненной, вы проверите и сохраните.",
  en: "Anything not recognised is left empty — nothing is guessed. The form opens prefilled for you to check and save."
};
