/* Keeping the rate snapshot fresh, without ever blocking the interface. */

import * as store from "./store.js?v=20260827-144201";
import * as rates from "./rates.js?v=20260827-144201";
import { fetchQuotes } from "./quotes.js?v=20260827-144201";

let inFlight = null;

export async function refreshRates({ force = false } = {}) {
  const settings = store.getSettings();
  const current = store.getRates();

  if (!force && !settings.autoRates) return { ok: false, skipped: "disabled" };
  if (!force && current && !rates.isStale(current)) return { ok: true, skipped: "fresh" };
  if (!navigator.onLine && !force) return { ok: false, skipped: "offline" };
  if (inFlight) return inFlight;

  const coins = [...new Set(store.recordsOfType("crypto").map((record) => record.coin).filter(Boolean))];

  const securities = store.recordsOfType("security").filter((record) => record.ticker);

  inFlight = rates.refresh(current, { coins })
    .then(async ({ snapshot, problems, ok }) => {
      // Manual overrides are the owner's own numbers and always survive a refresh.
      snapshot.manual = { ...(current?.manual || {}), ...(snapshot.manual || {}) };

      /* Share prices ride along with the currency refresh. A ticker that did
         not answer keeps whatever was stored before rather than blanking the
         whole portfolio, but its own entry is replaced when it does answer. */
      if (securities.length) {
        try {
          const fetched = await fetchQuotes(securities, { apiKey: settings.quotesApiKey || "" });
          snapshot.securities = { ...(current?.securities || {}), ...fetched.quotes };
          snapshot.securitiesFetchedAt = fetched.fetchedAt;
          if (fetched.missing.length) problems = [...(problems || []), `нет котировок: ${fetched.missing.join(", ")}`];
        } catch (error) {
          snapshot.securities = current?.securities || {};
          problems = [...(problems || []), String(error?.message || error)];
        }
      } else {
        snapshot.securities = current?.securities || {};
        snapshot.securitiesFetchedAt = current?.securitiesFetchedAt || null;
      }

      await store.setRates(snapshot);
      return { ok, problems };
    })
    .catch((error) => ({ ok: false, problems: [String(error?.message || error)] }))
    .finally(() => { inFlight = null; });

  return inFlight;
}

export function scheduleRateRefresh() {
  const run = () => { void refreshRates(); };
  if (document.visibilityState === "visible") run();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") run(); });
  window.addEventListener("online", run);
  // Once an hour is plenty for a published daily rate.
  setInterval(run, 3_600_000);
}
