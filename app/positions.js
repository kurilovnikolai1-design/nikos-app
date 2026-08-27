/* Whether owning something went well.
 *
 * Until now the app could say what a holding is worth. That is a different
 * question from whether it was a good idea, and for anyone who trades it is
 * the less interesting of the two. The missing half is what it cost.
 *
 * With a cost basis, three numbers become available and none of them need a
 * price feed beyond the one already in use: what it is worth now, what was
 * paid, and the difference. The percentage is the same difference expressed
 * against what was risked.
 *
 * Written to cover a crypto holding and a security position with the same
 * code, because they differ only in where the current price comes from.
 *
 * Deliberately unrealised only. This measures a position still held; money
 * already taken off the table needs a record of the sale, which is a
 * different thing and is not invented here. */

import { valueInBase } from "./finance.js?v=20260827-150156";
import { convertMinor } from "./rates.js?v=20260827-150156";

export const PNL_STATE = {
  NO_COST: "no-cost",       /* nothing to compare against */
  NO_PRICE: "no-price",     /* the market side is missing */
  UP: "up",
  DOWN: "down",
  FLAT: "flat"
};

/* One position. Returns a state rather than a number when either half is
   missing, so a screen can say which half rather than showing a false zero. */
export function positionPnl(record, base, rates) {
  const market = valueInBase(record, base, rates);

  const costMinor = record.costBasisMinor === null || record.costBasisMinor === undefined
    ? null
    : convertMinor(record.costBasisMinor, record.currency || base, base, rates);

  if (market.minor === null) {
    return { record, state: PNL_STATE.NO_PRICE, costMinor, reason: market.reason };
  }
  if (costMinor === null) {
    return { record, state: PNL_STATE.NO_COST, valueMinor: market.minor };
  }

  const pnlMinor = market.minor - costMinor;
  /* A position that cost nothing — a gift, an airdrop — has a gain but no
     meaningful percentage, and dividing by zero would print Infinity. */
  const pnlPercent = costMinor > 0 ? (pnlMinor / costMinor) * 100 : null;

  const quantity = Number(record.quantity);
  const hasQuantity = Number.isFinite(quantity) && quantity > 0;

  return {
    record,
    state: pnlMinor > 0 ? PNL_STATE.UP : pnlMinor < 0 ? PNL_STATE.DOWN : PNL_STATE.FLAT,
    valueMinor: market.minor,
    costMinor,
    pnlMinor,
    pnlPercent,
    manual: Boolean(market.manual),
    /* Per-unit prices, in the base currency, for holdings measured in units. */
    entryPriceMinor: hasQuantity ? Math.round(costMinor / quantity) : null,
    currentPriceMinor: hasQuantity ? Math.round(market.minor / quantity) : null,
    quantity: hasQuantity ? quantity : null
  };
}

/* Every position of the given types, plus the totals. Positions missing a
   cost basis are counted in the value but excluded from the profit — and
   counted separately, so the screen can say how much of the portfolio the
   profit figure actually covers. */
export function portfolio(records, base, rates, types = ["crypto"]) {
  const positions = records
    .filter((record) => types.includes(record.type) && !record.deletedAt)
    .filter((record) => record.status !== "archived")
    .map((record) => positionPnl(record, base, rates));

  let valueMinor = 0;
  let costMinor = 0;
  let withCost = 0;
  let withoutCost = 0;
  let unpriced = 0;

  for (const position of positions) {
    if (position.state === PNL_STATE.NO_PRICE) { unpriced += 1; continue; }
    valueMinor += position.valueMinor;
    if (position.state === PNL_STATE.NO_COST) { withoutCost += 1; continue; }
    costMinor += position.costMinor;
    withCost += 1;
  }

  const pnlMinor = valueMinor - costMinor;

  return {
    positions: positions.sort((a, b) => (b.valueMinor ?? 0) - (a.valueMinor ?? 0)),
    valueMinor,
    costMinor,
    /* Only meaningful when every counted position has a cost; otherwise it is
       today's value minus a partial cost, which is not a profit. */
    pnlMinor: withoutCost ? null : pnlMinor,
    pnlPercent: !withoutCost && costMinor > 0 ? (pnlMinor / costMinor) * 100 : null,
    withCost,
    withoutCost,
    unpriced
  };
}

export const PNL_NOTE = {
  ru: "Прибыль считается только по позициям, у которых указано, сколько вы вложили. Это бумажная прибыль по тому, что вы держите сейчас — проданное сюда не входит.",
  en: "Profit is counted only for positions with a cost basis. It is unrealised profit on what is currently held — anything already sold is not included."
};
