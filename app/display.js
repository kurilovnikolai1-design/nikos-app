/* The same total, also in dollars.
 *
 * Money is stored in whatever currency it arrived in and every total is
 * computed in one base — that is not negotiable, because a sum of mixed
 * currencies has to be reduced to one before it means anything.
 *
 * But the currency a total is computed in and the currency it is read in are
 * different questions. Income that arrives in dollars is thought about in
 * dollars, and "ушло 180 000 ₽" answers a question that was not asked.
 *
 * So a total carries its dollar figure in brackets beside it. Not a toggle,
 * not a setting to remember: both numbers, always, because the whole point is
 * comparing them without a step in between.
 *
 * Brackets only on totals. Putting them on every row of a list turns a column
 * of figures into noise, and a row is read for its own sake while a total is
 * read to be judged.
 *
 * When the rate is missing, nothing is added. An outdated conversion shown as
 * current is worse than one not shown, and the rate's age is already visible
 * on the capital screen. */

import { formatMoney } from "./money.js?v=20260828-004404";
import { convertMinor } from "./rates.js?v=20260828-004404";
import { getLocale } from "./i18n.js?v=20260828-004404";
import * as store from "./store.js?v=20260828-004404";

export const baseCurrency = () => store.getSettings().baseCurrency || "RUB";

/* The currency to show alongside. Defaults to dollars because that is what
   most of this owner's income arrives in; changing it changes every bracket. */
export const secondCurrency = () => store.getSettings().secondCurrency || "USD";

/* Nothing to add when the second currency is the base one, or when no rate is
   loaded to convert with. */
export const canShowSecond = () => {
  const second = secondCurrency();
  if (!second || second === baseCurrency()) return false;
  return convertMinor(100, baseCurrency(), second, store.getRates()) !== null;
};

/* The bracketed part on its own — "$463" — or null when it cannot be had. */
export function secondOnly(minorInBase, { locale = getLocale() } = {}) {
  if (minorInBase === null || minorInBase === undefined) return null;
  /* Nothing converts to nothing. "(0 $)" beside "0 ₽" is noise in a column of
     cards, and an empty category is common. */
  if (minorInBase === 0) return null;
  if (!canShowSecond()) return null;

  const converted = convertMinor(minorInBase, baseCurrency(), secondCurrency(), store.getRates());
  if (converted === null) return null;
  return formatMoney(converted, secondCurrency(), locale);
}

/* A total with its dollar figure beside it: "39 000 ₽ ($463)". Falls back to
   the plain figure whenever the second one is unavailable, so a missing rate
   costs a bracket rather than a number. */
export function total(minorInBase, { locale = getLocale() } = {}) {
  const primary = formatMoney(minorInBase, baseCurrency(), locale);
  const second = secondOnly(minorInBase, { locale });
  return second ? `${primary} (${second})` : primary;
}
