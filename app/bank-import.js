/* Reading a bank statement.
 *
 * Typing a month of spending by hand is how a money app stops being used by
 * the end of week two. Every Russian bank exports a statement; none of them
 * agree on the columns, and several write the amount with a comma, a
 * non-breaking space and a currency word in the same cell.
 *
 * So this reads by shape rather than by bank: find the date column, the
 * amount column and the description column by what the values look like, and
 * accept whichever separator the file uses. A statement it cannot read is
 * reported as unreadable rather than imported as zeroes.
 *
 * Sign decides direction. Money leaving is an expense, money arriving is
 * income — and where a bank writes both in separate debit and credit columns,
 * both are read. Nothing is categorised automatically beyond an obvious
 * keyword: a wrong category is harder to notice than a missing one.
 *
 * Imported rows arrive unconfirmed by design. These came from a file, not
 * from the owner, and that distinction is the one that keeps totals honest. */

/* Its own line splitter rather than csv.js's: that module also builds a
   dialog, so importing it pulls the DOM into a pure parser and makes this
   impossible to test outside a browser. Fifteen lines is a fair price for a
   module that depends on nothing. */
function splitLine(line, separator) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      /* A doubled quote inside a quoted cell is a literal quote. */
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (character === separator && !quoted) { cells.push(current); current = ""; continue; }
    current += character;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export const MAX_ROWS = 5000;

/* ---------- Finding the columns ---------- */

const DATE_RE = /^\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})|^\s*(\d{4})-(\d{2})-(\d{2})/;

const HEADER_HINTS = {
  date: /(дата|date|операц|проводк)/i,
  amount: /(сумма|amount|оборот|списан|зачислен|приход|расход|debit|credit)/i,
  description: /(описан|назначен|получател|контрагент|коммент|description|merchant|категор|место)/i,
  currency: /(валют|currency)/i
};

/* A cell holding money: digits, optional separators, optional currency word.
   "-1 234,56 ₽", "1234.56", "−12 000,00 RUB" all count. */
function toAmount(cell) {
  if (cell === null || cell === undefined) return null;
  const raw = String(cell)
    .replace(/ | |\s/g, "")
    .replace(/[₽$€]|RUB|USD|EUR|руб\.?/gi, "")
    .replace(/−|–|—/g, "-")
    .trim();
  if (!raw || !/\d/.test(raw)) return null;

  /* Both separators present: the last one is the decimal point. */
  let normalised = raw;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalised = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    /* A comma with exactly three digits after it is a thousands separator. */
    normalised = /,\d{3}$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
  }

  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

function toDate(cell) {
  const text = String(cell || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(text);
  if (!dmy) return null;
  const [, day, month, yearRaw] = dmy;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const detectSeparator = (line) => {
  const counts = [";", ",", "\t", "|"].map((sep) => [sep, line.split(sep).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ";";
};

/* ---------- Reading the file ---------- */

export function parseStatement(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return { ok: false, reason: "too-short", rows: [] };

  const separator = detectSeparator(lines[0]);
  const table = lines.slice(0, MAX_ROWS + 40).map((line) => splitLine(line, separator));

  /* Statements often carry a title, an account number and a blank line before
     the real header, so the header is found rather than assumed to be first. */
  let headerIndex = -1;
  for (let index = 0; index < Math.min(table.length, 30); index += 1) {
    const cells = table[index].map((cell) => String(cell || ""));
    if (HEADER_HINTS.date.test(cells.join(" ")) && HEADER_HINTS.amount.test(cells.join(" "))) {
      headerIndex = index;
      break;
    }
  }

  const header = headerIndex >= 0 ? table[headerIndex].map((cell) => String(cell || "")) : [];
  const body = table.slice(headerIndex + 1);

  const column = (hint) => header.findIndex((cell) => hint.test(cell));
  let dateAt = column(HEADER_HINTS.date);
  let descAt = column(HEADER_HINTS.description);
  const currencyAt = column(HEADER_HINTS.currency);

  /* Amount columns come in two shapes: one signed column, or separate debit
     and credit columns. Both are handled by collecting every money-looking
     header and reading whichever is filled on each row. */
  const amountColumns = header
    .map((cell, index) => ({ cell, index }))
    .filter((entry) => HEADER_HINTS.amount.test(entry.cell))
    .map((entry) => ({
      index: entry.index,
      /* A column named "списание"/"расход"/"debit" is money leaving even when
         the number in it is written without a minus. */
      forcedSign: /(списан|расход|debit)/i.test(entry.cell) ? -1
        : /(зачислен|приход|credit|поступлен)/i.test(entry.cell) ? 1 : 0
    }));

  /* No usable header: fall back to shape — the first column that parses as a
     date, and the last that parses as money. */
  if (dateAt < 0 || !amountColumns.length) {
    const sample = body.find((row) => row.some((cell) => DATE_RE.test(String(cell || ""))));
    if (!sample) return { ok: false, reason: "no-columns", rows: [] };
    if (dateAt < 0) dateAt = sample.findIndex((cell) => toDate(cell));
    if (!amountColumns.length) {
      const moneyAt = sample.map((cell, index) => ({ index, value: toAmount(cell) }))
        .filter((entry) => entry.value !== null && Math.abs(entry.value) >= 1)
        .map((entry) => entry.index)
        .at(-1);
      if (moneyAt === undefined) return { ok: false, reason: "no-columns", rows: [] };
      amountColumns.push({ index: moneyAt, forcedSign: 0 });
    }
    if (descAt < 0) {
      descAt = sample.findIndex((cell, index) =>
        index !== dateAt && !amountColumns.some((c) => c.index === index) && String(cell || "").trim().length > 3);
    }
  }

  const rows = [];
  let skipped = 0;

  for (const cells of body) {
    if (rows.length >= MAX_ROWS) break;

    const date = toDate(cells[dateAt]);
    if (!date) { skipped += 1; continue; }

    let amount = null;
    let sign = 0;
    for (const column of amountColumns) {
      const value = toAmount(cells[column.index]);
      if (value === null || value === 0) continue;
      amount = Math.abs(value);
      sign = column.forcedSign || (value < 0 ? -1 : 1);
      break;
    }
    if (amount === null) { skipped += 1; continue; }

    const description = String(cells[descAt] ?? "").trim()
      || (sign < 0 ? "Расход" : "Поступление");

    rows.push({
      date,
      amountMinor: Math.round(amount * 100),
      type: sign < 0 ? "expense" : "income",
      name: description.slice(0, 140),
      currency: normaliseCurrency(cells[currencyAt]),
      category: guessCategory(description, sign),
      include: true
    });
  }

  return { ok: rows.length > 0, reason: rows.length ? null : "no-rows", rows, skipped, separator };
}

const normaliseCurrency = (cell) => {
  const text = String(cell || "").toUpperCase();
  if (/USD|\$/.test(text)) return "USD";
  if (/EUR|€/.test(text)) return "EUR";
  if (/CNY|¥/.test(text)) return "CNY";
  return "RUB";
};

/* Only where the wording is unambiguous. A wrong category is harder to spot
   later than a blank one, so anything doubtful stays "other". */
const CATEGORY_HINTS = [
  { re: /(перевод|перевел|p2p|card2card)/i, expense: "other", income: "other" },
  { re: /(зарплат|аванс|оклад|salary)/i, income: "salary" },
  { re: /(аренд|наём|наем|rent)/i, income: "rent", expense: "housing" },
  { re: /(ипотек|mortgage)/i, expense: "mortgage" },
  { re: /(жкх|коммунал|电|энергосбыт|водоканал|газпром межрегион)/i, expense: "housing" },
  { re: /(азс|топлив|бензин|лукойл|роснефть|газпромнефть|парковк|такси|каршеринг)/i, expense: "transport" },
  { re: /(пятёрочк|пятерочк|магнит|перекрёсток|перекресток|лента|ашан|вкусвилл|продукт|супермаркет)/i, expense: "living" },
  { re: /(подписк|subscription|яндекс плюс|netflix|spotify|apple\.com\/bill)/i, expense: "subscription" },
  { re: /(аптек|клиник|медиц|стоматолог|лаборатор|kdl|инвитро)/i, expense: "health" },
  { re: /(школ|детсад|обучен|курс)/i, expense: "education" }
];

function guessCategory(description, sign) {
  for (const hint of CATEGORY_HINTS) {
    if (!hint.re.test(description)) continue;
    const key = sign < 0 ? hint.expense : hint.income;
    if (key) return key;
  }
  return "other";
}

export const BANK_NOTE = {
  ru: "Строки распознаются по виду значений, а не по названию банка. Всё импортированное остаётся неподтверждённым: это данные из файла, а не введённые вами, и в расчёты они войдут после вашей проверки.",
  en: "Rows are recognised by the shape of the values rather than by bank. Everything imported stays unconfirmed: it came from a file rather than from you, and it joins the totals once you have checked it."
};
