/* Share prices, fetched rather than typed.
 *
 * A portfolio priced by hand is a portfolio priced whenever its owner last
 * remembered to, which for anyone holding more than a couple of positions
 * means it is usually wrong. Crypto has been priced automatically since the
 * rebuild; securities were left to be typed in, and that was the gap.
 *
 * Two sources, because the market decides which one applies:
 *
 *   The Moscow Exchange publishes an open endpoint that answers a browser
 *   directly — no key, no account, correct CORS headers. Russian tickers cost
 *   nothing to price and need nothing from the owner.
 *
 *   Foreign tickers have no equivalent. Every free source either refuses
 *   cross-origin requests outright or wants an API key. So a key is optional:
 *   paste one and foreign positions price themselves, leave it empty and they
 *   fall back to a valuation entered by hand, exactly as before.
 *
 * A price that could not be fetched is reported as missing. It is never
 * carried forward silently from an older fetch and never guessed from a
 * neighbouring ticker — a stale price shown as current is worse than a blank,
 * because only one of the two prompts anyone to look. */

export const MARKET = {
  MOEX: "moex",
  FOREIGN: "foreign"
};

const MOEX_BASE = "https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities";
const FINNHUB_BASE = "https://finnhub.io/api/v1/quote";

/* MOEX answers with parallel arrays, so a column index has to be looked up by
   name rather than assumed by position — the order has changed before. */
const pick = (columns, row, name) => {
  const index = columns.indexOf(name);
  return index < 0 ? null : row[index];
};

/* One Russian ticker. Returns null rather than throwing: a portfolio should
   render with the prices that did arrive. */
export async function fetchMoexQuote(ticker, { signal } = {}) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(symbol)) return null;

  try {
    const url = `${MOEX_BASE}/${symbol}.json?iss.meta=off&iss.only=marketdata,securities`;
    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const payload = await response.json();
    const marketRow = payload.marketdata?.data?.[0];
    const securityRow = payload.securities?.data?.[0];
    if (!marketRow || !securityRow) return null;

    const marketColumns = payload.marketdata.columns;
    const securityColumns = payload.securities.columns;

    /* LAST is empty outside trading hours; the previous close is the honest
       fallback and is labelled as such rather than passed off as live. */
    const last = pick(marketColumns, marketRow, "LAST");
    const close = pick(marketColumns, marketRow, "LCLOSEPRICE")
      ?? pick(marketColumns, marketRow, "MARKETPRICE")
      ?? pick(securityColumns, securityRow, "PREVPRICE");

    const price = Number(last) > 0 ? Number(last) : Number(close);
    if (!Number.isFinite(price) || price <= 0) return null;

    /* MOEX writes the rouble as SUR; everything else in Nik'Os calls it RUB. */
    const rawCurrency = pick(securityColumns, securityRow, "CURRENCYID");
    const currency = rawCurrency === "SUR" ? "RUB" : (rawCurrency || "RUB");

    return {
      ticker: symbol,
      market: MARKET.MOEX,
      price,
      currency,
      name: pick(securityColumns, securityRow, "SECNAME") || symbol,
      lotSize: Number(pick(securityColumns, securityRow, "LOTSIZE")) || 1,
      live: Number(last) > 0
    };
  } catch {
    return null;
  }
}

/* One foreign ticker, when a key has been supplied. */
export async function fetchForeignQuote(ticker, apiKey, { signal } = {}) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!apiKey || !/^[A-Z.\-]{1,12}$/.test(symbol)) return null;

  try {
    const url = `${FINNHUB_BASE}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const payload = await response.json();
    /* Finnhub answers an unknown ticker with zeros rather than an error. */
    const price = Number(payload.c);
    if (!Number.isFinite(price) || price <= 0) return null;

    return {
      ticker: symbol,
      market: MARKET.FOREIGN,
      price,
      currency: "USD",
      name: symbol,
      lotSize: 1,
      live: true
    };
  } catch {
    return null;
  }
}

/* Prices for a whole portfolio. Requests run together but the result is a
   plain map, so one dead ticker costs one price rather than all of them. */
export async function fetchQuotes(securities, { apiKey = "", signal } = {}) {
  const wanted = new Map();
  for (const record of securities) {
    const ticker = String(record.ticker || "").trim().toUpperCase();
    if (!ticker) continue;
    const market = record.market === MARKET.FOREIGN ? MARKET.FOREIGN : MARKET.MOEX;
    wanted.set(`${market}:${ticker}`, { ticker, market });
  }
  if (!wanted.size) return { quotes: {}, fetchedAt: null, missing: [] };

  const results = await Promise.all([...wanted.values()].map(async ({ ticker, market }) => {
    const quote = market === MARKET.FOREIGN
      ? await fetchForeignQuote(ticker, apiKey, { signal })
      : await fetchMoexQuote(ticker, { signal });
    return [`${market}:${ticker}`, quote];
  }));

  const quotes = {};
  const missing = [];
  for (const [key, quote] of results) {
    if (quote) quotes[key] = quote;
    else missing.push(key);
  }

  return { quotes, fetchedAt: new Date().toISOString(), missing };
}

export const quoteKey = (record) =>
  `${record.market === MARKET.FOREIGN ? MARKET.FOREIGN : MARKET.MOEX}:${String(record.ticker || "").trim().toUpperCase()}`;

/* The stored price for one holding, or null. Kept separate from fetching so
   a screen can render offline from whatever was last stored. */
export const quoteFor = (record, snapshot) =>
  snapshot?.securities?.[quoteKey(record)] ?? null;

export const QUOTES_NOTE = {
  ru: "Российские бумаги оцениваются по данным МосБиржи — бесплатно и без ключа. Для иностранных нужен бесплатный ключ Finnhub; без него укажите оценку вручную.",
  en: "Russian tickers are priced from the Moscow Exchange feed — free and keyless. Foreign tickers need a free Finnhub key; without one, enter a valuation by hand."
};
