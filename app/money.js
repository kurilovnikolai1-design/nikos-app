/* Money is stored as integer minor units (копейки/cents) — never float.
   MASTER_SPEC §7.3: "Money values use numeric; never floating point." */

export const CURRENCIES = {
  RUB: { code: "RUB", minor: 2, symbol: "₽", ru: "Рубль", en: "Ruble" },
  USD: { code: "USD", minor: 2, symbol: "$", ru: "Доллар", en: "Dollar" },
  EUR: { code: "EUR", minor: 2, symbol: "€", ru: "Евро", en: "Euro" },
  CNY: { code: "CNY", minor: 2, symbol: "¥", ru: "Юань", en: "Yuan" },
  AED: { code: "AED", minor: 2, symbol: "د.إ", ru: "Дирхам", en: "Dirham" },
  KZT: { code: "KZT", minor: 2, symbol: "₸", ru: "Тенге", en: "Tenge" },
  TRY: { code: "TRY", minor: 2, symbol: "₺", ru: "Лира", en: "Lira" },
  GBP: { code: "GBP", minor: 2, symbol: "£", ru: "Фунт", en: "Pound" }
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);
export const isCurrency = (code) => Object.hasOwn(CURRENCIES, String(code || "").toUpperCase());
const minorFactor = (code) => 10 ** (CURRENCIES[code]?.minor ?? 2);

/* Parse human input ("1 234,56", "1234.56", "1.2m") into integer minor units.
   Returns null for anything that is not a finite number, so callers can tell
   "no amount" apart from "zero". */
export function parseAmount(input, currency = "RUB") {
  if (input === null || input === undefined) return null;
  let text = String(input).trim();
  if (!text) return null;

  let multiplier = 1;
  const suffix = text.match(/([kкmмbб])$/i);
  if (suffix) {
    const key = suffix[1].toLowerCase();
    multiplier = key === "k" || key === "к" ? 1e3 : key === "m" || key === "м" ? 1e6 : 1e9;
    text = text.slice(0, -1).trim();
  }

  text = text.replace(/[\s\u00a0\u202f']/g, "");
  // A comma is a decimal separator here; a dot may be either, so keep the last one.
  if (text.includes(",") && text.includes(".")) text = text.lastIndexOf(",") > text.lastIndexOf(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/,/g, "");
  else text = text.replace(",", ".");

  if (!/^-?\d*\.?\d*$/.test(text) || text === "" || text === "-" || text === ".") return null;

  const value = Number(text) * multiplier;
  if (!Number.isFinite(value)) return null;

  const minor = Math.round(value * minorFactor(currency));
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}

export const toMajor = (minor, currency = "RUB") =>
  minor === null || minor === undefined ? null : minor / minorFactor(currency);

export function formatMoney(minor, currency = "RUB", locale = "ru", { sign = false, compact = false } = {}) {
  if (minor === null || minor === undefined || !Number.isFinite(Number(minor))) return "—";
  const code = isCurrency(currency) ? String(currency).toUpperCase() : "RUB";
  const value = toMajor(Number(minor), code);
  const tag = locale === "ru" ? "ru-RU" : "en-US";
  const fractionDigits = Math.abs(value) >= 1000 || Number.isInteger(value) ? 0 : 2;

  const body = new Intl.NumberFormat(tag, {
    style: "currency",
    currency: code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    notation: compact && Math.abs(value) >= 1e6 ? "compact" : "standard"
  }).format(value);

  return sign && value > 0 ? `+${body}` : body;
}

/* Quantities (crypto, kilograms, kilometres) keep more precision than money. */
export function formatQuantity(value, unit = "", locale = "ru") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const digits = Math.abs(number) >= 1000 ? 0 : Math.abs(number) >= 1 ? 2 : 8;
  const body = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: digits
  }).format(number);
  return unit ? `${body} ${unit}` : body;
}
