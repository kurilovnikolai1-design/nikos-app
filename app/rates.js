/* Exchange rates as recorded snapshots, never as invented numbers.

   MASTER_SPEC §7.4: "Use a recorded FX snapshot and disclose rate source and
   timestamp." So every rate carries where it came from and when, the interface
   shows both, and going offline falls back to the last snapshot with its real
   date rather than silently pretending the number is current.

   Only public rate endpoints are contacted. No record ever leaves the device. */

import { CURRENCY_CODES } from "./money.js?v=20260827-115943";

export const SOURCES = {
  cbr: { id: "cbr", ru: "ЦБ РФ", en: "Bank of Russia", url: "https://www.cbr-xml-daily.ru/daily_json.js" },
  erapi: { id: "erapi", ru: "open.er-api.com", en: "open.er-api.com", url: "https://open.er-api.com/v6/latest/USD" },
  coingecko: { id: "coingecko", ru: "CoinGecko", en: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price" },
  manual: { id: "manual", ru: "Введено вручную", en: "Entered manually" }
};

export const STALE_AFTER_HOURS = 36;

/* Coins the crypto screen can price automatically. Anything else keeps a
   manual valuation and is labelled as such. */
export const COINS = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin", BNB: "binancecoin",
  SOL: "solana", XRP: "ripple", TON: "the-open-network", TRX: "tron", ADA: "cardano",
  DOGE: "dogecoin", DOT: "polkadot", MATIC: "matic-network", LTC: "litecoin", AVAX: "avalanche-2"
};

export const emptySnapshot = () => ({
  base: "RUB",
  perRub: {},          // how many RUB one unit of a currency is worth
  crypto: {},          // coin symbol -> USD price
  source: null,
  fetchedAt: null,
  cryptoFetchedAt: null,
  manual: {}           // currency -> RUB, always wins over a fetched rate
});

/* ---------- Fetching ---------- */

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* Bank of Russia publishes the official RUB rate, which is the number that
   matters for a Russian owner's taxes and reporting. */
async function fetchFromCbr() {
  const data = await fetchJson(SOURCES.cbr.url);
  if (!data?.Valute) throw new Error("unexpected shape");
  const perRub = { RUB: 1 };
  for (const code of CURRENCY_CODES) {
    if (code === "RUB") continue;
    const entry = data.Valute[code];
    if (entry?.Value && entry?.Nominal) perRub[code] = entry.Value / entry.Nominal;
  }
  return { perRub, source: SOURCES.cbr.id, fetchedAt: new Date().toISOString(), asOf: data.Date || null };
}

async function fetchFromErApi() {
  const data = await fetchJson(SOURCES.erapi.url);
  const rates = data?.rates;
  if (!rates?.RUB) throw new Error("unexpected shape");
  // The feed is USD-based; convert into "RUB per unit" to match the CBR shape.
  const perRub = { RUB: 1, USD: rates.RUB };
  for (const code of CURRENCY_CODES) {
    if (code === "RUB" || code === "USD") continue;
    if (rates[code]) perRub[code] = rates.RUB / rates[code];
  }
  return { perRub, source: SOURCES.erapi.id, fetchedAt: new Date().toISOString(), asOf: data.time_last_update_utc || null };
}

async function fetchCryptoPrices(symbols) {
  const ids = [...new Set(symbols.map((symbol) => COINS[String(symbol).toUpperCase()]).filter(Boolean))];
  if (!ids.length) return { crypto: {}, cryptoFetchedAt: new Date().toISOString() };
  const url = `${SOURCES.coingecko.url}?ids=${ids.join(",")}&vs_currencies=usd`;
  const data = await fetchJson(url);
  const crypto = {};
  for (const [symbol, id] of Object.entries(COINS)) {
    if (data?.[id]?.usd) crypto[symbol] = data[id].usd;
  }
  return { crypto, cryptoFetchedAt: new Date().toISOString() };
}

/* Refresh what we can; keep whatever we already had for the rest. */
export async function refresh(previous, { coins = [] } = {}) {
  const snapshot = { ...emptySnapshot(), ...(previous || {}) };
  const problems = [];

  try {
    Object.assign(snapshot, await fetchFromCbr());
  } catch (cbrError) {
    problems.push(`${SOURCES.cbr.ru}: ${cbrError.message}`);
    try {
      Object.assign(snapshot, await fetchFromErApi());
    } catch (fallbackError) {
      problems.push(`${SOURCES.erapi.ru}: ${fallbackError.message}`);
    }
  }

  if (coins.length) {
    try {
      Object.assign(snapshot, await fetchCryptoPrices(coins));
    } catch (cryptoError) {
      problems.push(`${SOURCES.coingecko.ru}: ${cryptoError.message}`);
    }
  }

  return { snapshot, problems, ok: problems.length === 0 };
}

/* ---------- Using rates ---------- */

/* RUB value of one unit of `code`. Manual entries always win, because the
   owner's own deal rate beats any published one. */
export function rubPerUnit(snapshot, code) {
  const currency = String(code || "RUB").toUpperCase();
  if (currency === "RUB") return 1;
  const manual = Number(snapshot?.manual?.[currency]);
  if (Number.isFinite(manual) && manual > 0) return manual;
  const fetched = Number(snapshot?.perRub?.[currency]);
  return Number.isFinite(fetched) && fetched > 0 ? fetched : null;
}

/* Convert integer minor units between currencies. Returns null when no rate
   is known, so callers can show "нет курса" instead of a fabricated total. */
export function convertMinor(minor, from, to, snapshot) {
  if (minor === null || minor === undefined || !Number.isFinite(Number(minor))) return null;
  const source = String(from || "RUB").toUpperCase();
  const target = String(to || "RUB").toUpperCase();
  if (source === target) return Math.round(Number(minor));

  const fromRub = rubPerUnit(snapshot, source);
  const toRub = rubPerUnit(snapshot, target);
  if (!fromRub || !toRub) return null;

  return Math.round((Number(minor) * fromRub) / toRub);
}

export function cryptoUsdPrice(snapshot, symbol) {
  const price = Number(snapshot?.crypto?.[String(symbol || "").toUpperCase()]);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/* Crypto is quoted in USD by design, then converted once for net worth. */
export function cryptoValueMinorUsd(quantity, symbol, snapshot) {
  const price = cryptoUsdPrice(snapshot, symbol);
  const amount = Number(quantity);
  if (!price || !Number.isFinite(amount)) return null;
  return Math.round(amount * price * 100);
}

export function isStale(snapshot) {
  if (!snapshot?.fetchedAt) return true;
  const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return !Number.isFinite(age) || age > STALE_AFTER_HOURS * 3_600_000;
}

export function sourceLabel(snapshot, locale = "ru") {
  const source = SOURCES[snapshot?.source];
  if (!source) return locale === "ru" ? "нет источника" : "no source";
  return locale === "ru" ? source.ru : source.en;
}

export const knownCurrencies = (snapshot) =>
  CURRENCY_CODES.filter((code) => code === "RUB" || rubPerUnit(snapshot, code) !== null);

export const missingRates = (snapshot, codes) =>
  [...new Set(codes)].filter((code) => rubPerUnit(snapshot, code) === null);
