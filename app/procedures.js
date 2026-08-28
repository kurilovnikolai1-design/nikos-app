/* Reading a procedure report — a colonoscopy, a gastroscopy, an ultrasound.
 *
 * Unlike a laboratory table, a report is prose. There is nothing here to
 * parse into numbers and nothing that should be. What this file does is
 * strictly clerical: find where the report says its own date, lift out the
 * section the doctor labelled "Заключение", and notice when the doctor wrote
 * down when to come back.
 *
 * Everything it produces is a quotation from the owner's own document. It
 * never summarises, never rewrites, and never decides that a follow-up is
 * needed — it only reads back one the report already states. If the report
 * does not say something, the field stays empty rather than being guessed.
 *
 * The full text is always kept alongside whatever was extracted, so nothing
 * depends on this file having understood the layout correctly. */

import { localDate } from "./dates.js?v=20260827-172643";

const MONTHS = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "мая": 5, "май": 5, "июн": 6,
  "июл": 7, "август": 8, "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12
};

const pad = (value) => String(value).padStart(2, "0");

/* Dates appear as 12.03.2026, 12/03/2026, 2026-03-12 or "12 марта 2026". */
export function findDate(text) {
  const numeric = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/);
  if (numeric) {
    const [, day, month, year] = numeric;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const written = text.match(/\b(\d{1,2})\s+([А-Яа-яЁё]{3,})\s+(\d{4})\b/);
  if (written) {
    const key = Object.keys(MONTHS).find((stem) => written[2].toLowerCase().startsWith(stem));
    if (key) return `${written[3]}-${pad(MONTHS[key])}-${pad(written[1])}`;
  }
  return null;
}

/* Which examination this is. Matched against how these are actually written on
   a Russian report, including the abbreviations. */
const KINDS = [
  { re: /колоноскоп|фкс\b|видеоколоноскоп/i, ru: "Колоноскопия", en: "Colonoscopy" },
  { re: /(эзофаго)?гастро(дуодено)?скоп|эгдс|фгдс|фгс\b/i, ru: "Гастроскопия (ЭГДС)", en: "Gastroscopy" },
  { re: /ректороманоскоп|ррс\b/i, ru: "Ректороманоскопия", en: "Sigmoidoscopy" },
  { re: /бронхоскоп/i, ru: "Бронхоскопия", en: "Bronchoscopy" },
  { re: /цистоскоп/i, ru: "Цистоскопия", en: "Cystoscopy" },
  { re: /узи|ультразвуков/i, ru: "УЗИ", en: "Ultrasound" },
  { re: /\bмрт\b|магнитно-резонанс/i, ru: "МРТ", en: "MRI" },
  { re: /\bкт\b|компьютерн(ая|ой) томограф/i, ru: "КТ", en: "CT" },
  { re: /рентген|флюорограф/i, ru: "Рентген", en: "X-ray" },
  { re: /эхокардиограф|эхо-?кг/i, ru: "ЭхоКГ", en: "Echocardiogram" },
  { re: /электрокардиограф|\bэкг\b/i, ru: "ЭКГ", en: "ECG" },
  { re: /гастроскоп/i, ru: "Гастроскопия", en: "Gastroscopy" },
  { re: /биопси/i, ru: "Биопсия", en: "Biopsy" }
];

export function findKind(text, locale = "ru") {
  const kind = KINDS.find((entry) => entry.re.test(text));
  return kind ? (locale === "ru" ? kind.ru : kind.en) : null;
}

/* The section a doctor labelled as the conclusion. Taken verbatim, from the
   label to the next all-caps heading or the end of the report. */
export function findConclusion(text) {
  const label = /(заключени[ея]|выводы?|диагноз)\s*[:.]?\s*/i.exec(text);
  if (!label) return null;

  const after = text.slice(label.index + label[0].length);

  /* Stop at the next heading — a line that is a label of its own. */
  const stop = after.search(/\n\s*(рекоменд|назначен|врач|подпись|материал|биопси[яй]\s*:|дата)/i);
  const body = (stop > 0 ? after.slice(0, stop) : after).trim();

  return body ? body.replace(/\s*\n\s*/g, " ").trim() : null;
}

/* What the report itself says about coming back. Only reported when the
   document states it — an interval is never inferred from the findings. */
const INTERVALS = [
  { re: /через\s+(\d+)\s*(год|года|лет)/i, unit: "year" },
  { re: /через\s+(\d+)\s*(месяц\w*)/i, unit: "month" },
  { re: /(ежегодн|раз в год)/i, unit: "year", fixed: 1 },
  { re: /(каждые|раз в)\s+(\d+)\s*(год|года|лет)/i, unit: "year", group: 2 }
];

export function findFollowUp(text, from = null) {
  const context = /(рекоменд|контроль|повтор|наблюдени)/i.test(text) ? text : "";
  if (!context) return null;

  for (const interval of INTERVALS) {
    const match = interval.re.exec(context);
    if (!match) continue;

    const amount = interval.fixed ?? Number(match[interval.group ?? 1]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 20) continue;

    /* The whole sentence it came from, so the owner can check the reading
       against the document rather than against a fragment of it. */
    const boundary = /[.\n]/;
    const before = context.slice(0, match.index).split(boundary).pop();
    const rest = context.slice(match.index);
    const stopAt = rest.search(boundary);
    const sentence = (before + (stopAt > 0 ? rest.slice(0, stopAt) : rest)).trim();

    const base = from ? new Date(`${from}T12:00:00`) : new Date();
    if (Number.isNaN(base.getTime())) return null;
    const next = new Date(base);
    if (interval.unit === "year") next.setFullYear(next.getFullYear() + amount);
    else next.setMonth(next.getMonth() + amount);

    return { date: localDate(next), amount, unit: interval.unit, quote: sentence };
  }
  return null;
}

/* Everything the report will fill in for itself. Whatever is missing stays
   null and gets typed by hand — which is the honest outcome, not a failure. */
export function parseReport(text, locale = "ru") {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return null;

  const date = findDate(clean);
  const kind = findKind(clean, locale);
  const conclusion = findConclusion(clean);
  const followUp = findFollowUp(clean, date);

  return {
    date,
    kind,
    conclusion,
    followUp,
    /* Kept whole and always: the extraction above is a convenience, not the
       record. If it read the layout wrongly, nothing is lost. */
    fullText: clean,
    /* How much was recognised, so the dialog can be honest about it. */
    found: [date && "date", kind && "kind", conclusion && "conclusion", followUp && "followUp"].filter(Boolean)
  };
}

/* The draft this becomes. A health record in the procedure category. */
export function toRecord(parsed, locale = "ru") {
  if (!parsed) return null;
  return {
    category: "procedure",
    status: "confirmed",
    owner: "me",
    name: parsed.kind || (locale === "ru" ? "Исследование" : "Procedure"),
    date: parsed.date || localDate(),
    details: parsed.conclusion
      ? `${locale === "ru" ? "Заключение" : "Conclusion"}: ${parsed.conclusion}\n\n${parsed.fullText}`
      : parsed.fullText,
    reminderDate: parsed.followUp?.date || null
  };
}

export const PROCEDURE_NOTE = {
  ru: "Текст выписки сохраняется целиком. Nik'Os только находит в нём дату, вид исследования и заключение — своими словами он ничего не добавляет и ничего не толкует.",
  en: "The report is stored in full. Nik'Os only locates the date, the kind of examination and the conclusion inside it — it adds nothing of its own and interprets nothing."
};
