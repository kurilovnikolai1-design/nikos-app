/* Parsing a laboratory report, with no DOM in sight.

   Kept apart from the dialog so it can be exercised by `node app/selftest.js`.
   A parser that decides which of your blood values is out of range is exactly
   the kind of code that must be testable without a browser.

   Every judgement is made against the range the laboratory itself printed.
   Nik'Os never supplies a reference range of its own. */

/* Analyte names seen on Russian and English lab reports, mapped to a panel.
   Only used to pre-sort rows; the owner can change any of them before saving. */
const PANEL_HINTS = [
  { category: "blood", re: /(гемоглобин|эритроцит|лейкоцит|тромбоцит|гематокрит|соэ|нейтрофил|лимфоцит|моноцит|эозинофил|базофил|ретикулоцит|mcv|mch|mchc|rdw|haemoglob|hemoglob|erythro|leuko|platelet|hematocrit)/i },
  { category: "lipids", re: /(холестерин|хс[\s-]|лпнп|лпвп|лпонп|триглицерид|индекс атероген|cholesterol|ldl|hdl|triglycerid)/i },
  { category: "thyroid", re: /(ттг|т3|т4|тиреоглобулин|антитела к тпо|тиреотроп|tsh|thyrox|triiodo)/i },
  { category: "hormones", re: /(тестостерон|кортизол|пролактин|эстрадиол|прогестерон|лг|фсг|инсулин|дгэа|соматотроп|testoster|cortisol|prolactin|estradiol|insulin)/i },
  { category: "vitamins", re: /(витамин|ферритин|железо|фолиев|цинк|магний|кальций|калий|натрий|селен|b12|d3|25-oh|vitamin|ferritin|iron|folate|magnesium|calcium)/i },
  { category: "urine", re: /(моч[аеи]|удельный вес|кетон|уробилиноген|urine|urinal)/i },
  { category: "markers", re: /(с-реактивн|срб|пса|са[\s-]?125|са[\s-]?19|рэа|афп|гомоцистеин|crp|psa|homocystein)/i },
  { category: "biochem", re: /(глюкоза|креатинин|мочевина|билирубин|алт|аст|ггт|щелочная фосфатаза|общий белок|альбумин|амилаза|мочевая кислота|glucose|creatinin|urea|bilirubin|alt|ast|ggt|albumin|protein)/i }
];

const panelFor = (name) => PANEL_HINTS.find((hint) => hint.re.test(name))?.category || "other";

/* Units that appear right after a value on a report. */
const UNIT = String.raw`(?:%|‰|г\/л|г\/дл|мг\/л|мг\/дл|мг\/сут|мкг\/л|мкг\/дл|мкг\/сут|нг\/мл|нг\/дл|пг\/мл|мкмоль\/л|ммоль\/л|нмоль\/л|пмоль\/л|мкг\/мл|ед\/л|Ед\/л|МЕ\/л|мМЕ\/л|мкМЕ\/мл|МЕ\/мл|Ед|фл|пг|мм\/ч|мм\s?рт\.?\s?ст\.?|кг\/м2|10\^?\d+\/л|10\*?\d+\/л|x?10\^?\d+\/[lл]|тыс\/мкл|млн\/мкл|клеток\/мкл|g\/l|g\/dl|mg\/l|mg\/dl|ng\/ml|pg\/ml|umol\/l|mmol\/l|nmol\/l|pmol\/l|u\/l|iu\/l|miu\/l|uiu\/ml|mm\/h|fl|pg|cells\/ul)`;

const NUMBER = String.raw`-?\d{1,7}(?:[.,]\d{1,4})?`;
const DASH = String.raw`(?:-|–|—|\.\.\.|\.\.|до|to)`;

/* Reports are read from the right, not the left.

   Reading left to right broke on any analyte whose own name contains a number:
   "Витамин D (25-OH)  22,5  нг/мл  30 - 100" was parsed as the value 25. So the
   reference range is peeled off the end first, then the unit, then the last
   remaining number is the value, and whatever is left over is the name. */

const RANGE_AT_END = new RegExp(String.raw`[\(\[]?\s*(${NUMBER})\s*${DASH}\s*(${NUMBER})\s*[\)\]]?\s*$`);
const OPEN_AT_END = new RegExp(String.raw`(<|>|менее|более|не более|не менее|less than|greater than)\s*(${NUMBER})\s*$`, "i");
const UNIT_AT_END = new RegExp(String.raw`(${UNIT})\s*$`, "i");
const VALUE_AT_END = new RegExp(String.raw`(${NUMBER})\s*$`);

/* A name has to read like one: at least two letters in a row. */
const LOOKS_LIKE_NAME = /[A-Za-zА-Яа-яЁё]{2}/;

const num = (text) => {
  if (text === undefined || text === null || text === "") return null;
  const value = Number(String(text).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(value) ? value : null;
};

const cleanName = (text) => String(text)
  .replace(/^[\s•·*\-–—\d.)]+/, "")
  .replace(/\s{2,}/g, " ")
  .replace(/[.;:,]+$/, "")
  .trim();

/* Headings, footers and laboratory boilerplate rather than results. */
const NOISE = /^(результат|показател|референс|наименование|единиц|норма|метод|материал|пациент|врач|дата|заказ|номер|страница|лаборатор|заключени|комментар|возраст|пол\b|итого|result|reference|unit|method|patient|page|age|sex)/i;

function parseLine(line) {
  let rest = line.trimEnd();
  if (rest.trim().length < 4) return null;

  let low = null;
  let high = null;

  const range = RANGE_AT_END.exec(rest);
  if (range) {
    low = num(range[1]);
    high = num(range[2]);
    rest = rest.slice(0, range.index).trimEnd();
  } else {
    const open = OPEN_AT_END.exec(rest);
    if (open) {
      const bound = num(open[2]);
      if (/^(<|менее|не более|less)/i.test(open[1])) high = bound;
      else low = bound;
      rest = rest.slice(0, open.index).trimEnd();
    }
  }

  let unit = "";
  const unitMatch = UNIT_AT_END.exec(rest);
  if (unitMatch) {
    unit = unitMatch[1].trim();
    rest = rest.slice(0, unitMatch.index).trimEnd();
  }

  const valueMatch = VALUE_AT_END.exec(rest);
  if (!valueMatch) return null;
  const value = num(valueMatch[1]);
  if (value === null) return null;

  const name = cleanName(rest.slice(0, valueMatch.index));
  if (!name || name.length < 2 || !LOOKS_LIKE_NAME.test(name)) return null;
  if (NOISE.test(name)) return null;

  if (low !== null && high !== null && low > high) [low, high] = [high, low];

  return { name, value, unit, refLow: low, refHigh: high, category: panelFor(name), include: true };
}

export function parseLabText(text) {
  const rows = [];
  const seen = new Set();

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\u00a0/g, " ");
    if (!line.trim()) continue;

    const row = parseLine(line);
    if (!row) continue;

    const key = `${row.name.toLowerCase()}|${row.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

/* A date printed anywhere in the pasted block, so the owner rarely types it. */
export function guessDate(text) {
  const patterns = [
    /(\d{2})[.\/](\d{2})[.\/](\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(String(text));
    if (!found) continue;
    const [, a, b, c] = found;
    const iso = a.length === 4 ? `${a}-${b}-${c}` : `${c}-${b}-${a}`;
    const date = new Date(`${iso}T12:00:00`);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() > 2000 && date <= new Date()) return iso;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function guessLab(text) {
  const labs = ["Инвитро", "Гемотест", "KDL", "Хеликс", "Ситилаб", "СИТИЛАБ", "Лабквест", "CMD", "Синэво", "Quest", "Labcorp"];
  const found = labs.find((lab) => new RegExp(lab, "i").test(String(text)));
  return found || "";
}

/* Verdict against the laboratory's own printed range — never a rule of ours. */
export function rangeVerdict(record) {
  const value = Number(record.value);
  if (!Number.isFinite(value)) return null;
  const low = record.refLow === null || record.refLow === undefined ? null : Number(record.refLow);
  const high = record.refHigh === null || record.refHigh === undefined ? null : Number(record.refHigh);
  if (low === null && high === null) return null;
  if (high !== null && value > high) return "above";
  if (low !== null && value < low) return "below";
  return "in";
}
