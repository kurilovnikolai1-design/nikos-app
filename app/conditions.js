/* A named condition and the tests usually tracked alongside it.
 *
 * The same narrow, administrative question as lab-routing.js, asked from the
 * other end: not "who reads this test" but "which tests belong to this
 * condition". That mapping is public, stable and identical for everyone — it
 * is the contents of a follow-up panel, not a reading of anybody's results.
 *
 * What this produces is a list of the owner's OWN numbers with their OWN
 * dates, plus arithmetic on how long ago each was taken. Nothing here says a
 * value is good, bad, rising, or means anything. The single judgement it makes
 * is "this has not been measured for a while", which is a statement about a
 * calendar, not about a body.
 *
 * Conditions are not inferred from results. They are only read from records
 * the owner entered himself — a health record in the "condition" category.
 * Guessing a diagnosis from an analyte is precisely the thing this product
 * does not do. */

import { byAnalyte } from "./labs-parse.js?v=20260827-145737";

const DAY = 86_400_000;

/* Each entry lists what is commonly monitored, and how often follow-up is
   typically scheduled — used only to say "it has been longer than that". */
const CONDITIONS = [
  {
    key: "haemochromatosis",
    match: /гемохроматоз|haemochromat|hemochromat/i,
    name: { ru: "Гемохроматоз", en: "Haemochromatosis" },
    specialist: { ru: "Гематолог или гепатолог", en: "Haematologist or hepatologist" },
    everyMonths: 6,
    hereditary: true,
    tracks: [
      { re: /ферритин/i,                              label: { ru: "Ферритин", en: "Ferritin" } },
      { re: /коэффициент насыщения трансферрина|насыщени.*трансферрин/i,
        label: { ru: "Насыщение трансферрина", en: "Transferrin saturation" } },
      { re: /^железо/i,                               label: { ru: "Железо", en: "Serum iron" } },
      { re: /^трансферрин/i,                          label: { ru: "Трансферрин", en: "Transferrin" } },
      { re: /общая железосвязывающая/i,               label: { ru: "ОЖСС", en: "Total iron-binding capacity" } },
      { re: /аланинаминотрансфераза/i,                label: { ru: "АЛТ", en: "ALT" } },
      { re: /аспартатаминотрансфераза/i,              label: { ru: "АСТ", en: "AST" } },
      { re: /^глюкоза$/i,                             label: { ru: "Глюкоза", en: "Glucose" } }
    ]
  },
  {
    key: "diabetes",
    match: /диабет|diabet/i,
    name: { ru: "Сахарный диабет", en: "Diabetes" },
    specialist: { ru: "Эндокринолог", en: "Endocrinologist" },
    everyMonths: 3,
    tracks: [
      { re: /гликированн/i,   label: { ru: "Гликированный гемоглобин", en: "HbA1c" } },
      { re: /^глюкоза$/i,     label: { ru: "Глюкоза", en: "Glucose" } },
      { re: /креатинин/i,     label: { ru: "Креатинин", en: "Creatinine" } },
      { re: /холестерин общий/i, label: { ru: "Холестерин", en: "Cholesterol" } },
      { re: /микроальбумин|альбумин.*моч/i, label: { ru: "Альбумин в моче", en: "Urine albumin" } }
    ]
  },
  {
    key: "thyroid",
    match: /щитовидн|тиреоид|гипотиреоз|тиреотоксикоз|thyroid/i,
    name: { ru: "Щитовидная железа", en: "Thyroid condition" },
    specialist: { ru: "Эндокринолог", en: "Endocrinologist" },
    everyMonths: 6,
    tracks: [
      { re: /тиреотроп/i,   label: { ru: "ТТГ", en: "TSH" } },
      { re: /т4 свободный|тироксин свободный/i, label: { ru: "Т4 свободный", en: "Free T4" } },
      { re: /т3 свободный|трийодтиронин свободный/i, label: { ru: "Т3 свободный", en: "Free T3" } },
      { re: /антитела к тпо|тиреоперокс/i, label: { ru: "Антитела к ТПО", en: "Anti-TPO" } }
    ]
  },
  {
    key: "hypertension",
    match: /гипертони|давлени|hypertens/i,
    name: { ru: "Гипертония", en: "Hypertension" },
    specialist: { ru: "Кардиолог", en: "Cardiologist" },
    everyMonths: 12,
    tracks: [
      { re: /холестерин общий/i, label: { ru: "Холестерин", en: "Cholesterol" } },
      { re: /лпнп/i,        label: { ru: "ЛПНП", en: "LDL" } },
      { re: /креатинин/i,   label: { ru: "Креатинин", en: "Creatinine" } },
      { re: /калий/i,       label: { ru: "Калий", en: "Potassium" } },
      { re: /^глюкоза$/i,   label: { ru: "Глюкоза", en: "Glucose" } }
    ]
  },
  {
    key: "gout",
    match: /подагр|gout/i,
    name: { ru: "Подагра", en: "Gout" },
    specialist: { ru: "Ревматолог", en: "Rheumatologist" },
    everyMonths: 6,
    tracks: [
      { re: /мочевая кислота/i, label: { ru: "Мочевая кислота", en: "Uric acid" } },
      { re: /креатинин/i,       label: { ru: "Креатинин", en: "Creatinine" } },
      { re: /с-реактивн/i,      label: { ru: "С-реактивный белок", en: "CRP" } }
    ]
  },
  {
    key: "liver",
    match: /гепатит|цирроз|печен|стеатоз|hepatit/i,
    name: { ru: "Печень", en: "Liver condition" },
    specialist: { ru: "Гастроэнтеролог или гепатолог", en: "Gastroenterologist or hepatologist" },
    everyMonths: 6,
    tracks: [
      { re: /аланинаминотрансфераза/i,   label: { ru: "АЛТ", en: "ALT" } },
      { re: /аспартатаминотрансфераза/i, label: { ru: "АСТ", en: "AST" } },
      { re: /гамма-глутамил/i,           label: { ru: "ГГТ", en: "GGT" } },
      { re: /билирубин общий/i,          label: { ru: "Билирубин", en: "Bilirubin" } },
      { re: /щелочная\s+фосфатаза/i,     label: { ru: "Щелочная фосфатаза", en: "ALP" } },
      { re: /общий белок/i,              label: { ru: "Общий белок", en: "Total protein" } }
    ]
  },
  {
    key: "kidney",
    match: /почечн|нефро|мочекаменн|kidney|renal/i,
    name: { ru: "Почки", en: "Kidney condition" },
    specialist: { ru: "Нефролог", en: "Nephrologist" },
    everyMonths: 6,
    tracks: [
      { re: /креатинин/i,   label: { ru: "Креатинин", en: "Creatinine" } },
      { re: /мочевина/i,    label: { ru: "Мочевина", en: "Urea" } },
      { re: /клубочков|скф/i, label: { ru: "СКФ", en: "eGFR" } },
      { re: /мочевая кислота/i, label: { ru: "Мочевая кислота", en: "Uric acid" } }
    ]
  },
  {
    key: "coeliac",
    match: /целиаки|глютен|непереносимост.*глютен|coeliac|celiac/i,
    name: { ru: "Целиакия / непереносимость глютена", en: "Coeliac disease" },
    specialist: { ru: "Гастроэнтеролог", en: "Gastroenterologist" },
    everyMonths: 12,
    hereditary: true,
    tracks: [
      { re: /трансглутаминаз/i, label: { ru: "Антитела к трансглутаминазе", en: "Anti-tTG" } },
      { re: /клейковина|глютен/i, label: { ru: "Глютен IgE", en: "Gluten IgE" } },
      { re: /ферритин/i,       label: { ru: "Ферритин", en: "Ferritin" } },
      { re: /витамин в12|цианокобаламин/i, label: { ru: "Витамин B12", en: "Vitamin B12" } }
    ]
  },
  {
    key: "anaemia",
    match: /анеми|anaemi|anemi/i,
    name: { ru: "Анемия", en: "Anaemia" },
    specialist: { ru: "Гематолог", en: "Haematologist" },
    everyMonths: 6,
    tracks: [
      { re: /^гемоглобин/i,  label: { ru: "Гемоглобин", en: "Haemoglobin" } },
      { re: /ферритин/i,     label: { ru: "Ферритин", en: "Ferritin" } },
      { re: /^железо/i,      label: { ru: "Железо", en: "Serum iron" } },
      { re: /витамин в12|цианокобаламин/i, label: { ru: "Витамин B12", en: "Vitamin B12" } },
      { re: /фолиев/i,       label: { ru: "Фолиевая кислота", en: "Folate" } }
    ]
  },
  {
    key: "allergy",
    match: /аллерг|астма|поллиноз|allerg|asthma/i,
    name: { ru: "Аллергия", en: "Allergy" },
    specialist: { ru: "Аллерголог-иммунолог", en: "Allergist-immunologist" },
    everyMonths: 12,
    tracks: [
      { re: /иммуноглобулин е|\bige\b/i, label: { ru: "Общий IgE", en: "Total IgE" } },
      { re: /эозинофил/i, label: { ru: "Эозинофилы", en: "Eosinophils" } }
    ]
  }
];

/* The owner's conditions, read only from what he wrote down himself. */
export function knownConditions(records) {
  const declared = records.filter((record) =>
    record.type === "health" && !record.deletedAt && record.category === "condition"
    /* "closed" marks a finding the owner has dealt with — see resolved.js.
       It shares this category, so it must not read as a live condition. */
    && record.status !== "closed");

  const found = [];
  for (const record of declared) {
    const text = `${record.name || ""} ${record.details || ""}`;
    const entry = CONDITIONS.find((condition) => condition.match.test(text));
    if (!entry) continue;

    const existing = found.find((item) => item.key === entry.key);
    /* The same condition can be recorded for several people — it is hereditary
       often enough that a family carries it together. One panel, several
       owners, rather than one panel silently standing for whoever came first. */
    if (existing) { existing.owners.push(record.owner || "me"); continue; }
    found.push({ ...entry, recordId: record.id, recordName: record.name, owners: [record.owner || "me"] });
  }
  return found;
}

/* Conditions this catalogue knows about but the owner has not written down.
   Offered as a list to tick, never assumed from results. */
export function offerableConditions(records, locale = "ru") {
  const have = new Set(knownConditions(records).map((item) => item.key));
  return CONDITIONS
    .filter((condition) => !have.has(condition.key))
    .map((condition) => ({ key: condition.key, name: locale === "ru" ? condition.name.ru : condition.name.en }));
}

/* For each declared condition: the tracked analytes present in the history,
   with the owner's own latest value, its date, and how old it is. */
export function conditionPanels(records, { locale = "ru", now = Date.now() } = {}) {
  const conditions = knownConditions(records);
  if (!conditions.length) return [];

  const groups = byAnalyte(records);
  const ru = locale === "ru";

  return conditions.map((condition) => {
    const tracked = [];
    const missing = [];

    for (const track of condition.tracks) {
      const group = groups.find((item) => track.re.test(item.name));
      const label = ru ? track.label.ru : track.label.en;
      if (!group) { missing.push(label); continue; }

      const days = Math.round((now - new Date(`${group.latest.date}T12:00:00`).getTime()) / DAY);
      tracked.push({
        label,
        name: group.name,
        group,
        value: group.latest.value,
        unit: group.unit,
        date: group.latest.date,
        days,
        verdict: group.verdict,
        /* Overdue is arithmetic on the calendar, not a claim about the body. */
        overdue: days > condition.everyMonths * 30
      });
    }

    tracked.sort((a, b) => b.days - a.days);

    return {
      key: condition.key,
      name: ru ? condition.name.ru : condition.name.en,
      recordName: condition.recordName,
      specialist: ru ? condition.specialist.ru : condition.specialist.en,
      everyMonths: condition.everyMonths,
      hereditary: Boolean(condition.hereditary),
      /* Only the owner's own results are in this history, so the follow-up
         list below is his and nobody else's, however many people carry it. */
      owners: [...new Set(condition.owners)],
      tracked,
      missing,
      overdueCount: tracked.filter((item) => item.overdue).length
    };
  });
}

/* Everything overdue across every declared condition, as plain reminders the
   notifier can deliver. Deliberately a statement about the calendar: it says
   an analyte has not been measured for longer than the follow-up interval
   usually used, never that anything is wrong. */
export function overdueChecks(records, { locale = "ru", now = Date.now() } = {}) {
  const out = [];

  for (const panel of conditionPanels(records, { locale, now })) {
    for (const entry of panel.tracked) {
      if (!entry.overdue) continue;
      out.push({
        condition: panel.name,
        specialist: panel.specialist,
        analyte: entry.label,
        name: entry.name,
        date: entry.date,
        months: Math.round(entry.days / 30),
        everyMonths: panel.everyMonths
      });
    }
  }

  return out.sort((a, b) => b.months - a.months);
}

export const CONDITION_NOTE = {
  ru: "Список того, что обычно отслеживают при этом состоянии, и ваши собственные последние значения с датами. Это не наблюдение за вашим здоровьем и не оценка результатов — только напоминание, что и когда измерялось. Периодичность ориентировочная, реальную назначает врач.",
  en: "What is commonly tracked alongside this condition, together with your own latest values and their dates. It is not an assessment of your results — only a record of what was measured and when. The intervals are indicative; the real schedule is set by a doctor."
};

export const CONDITION_KEYS = CONDITIONS.map((condition) => condition.key);
