/* Keeping the rate snapshot fresh, without ever blocking the interface. */

import * as store from "./store.js?v=20260827-085213";
import * as rates from "./rates.js?v=20260827-085213";

let inFlight = null;

export async function refreshRates({ force = false } = {}) {
  const settings = store.getSettings();
  const current = store.getRates();

  if (!force && !settings.autoRates) return { ok: false, skipped: "disabled" };
  if (!force && current && !rates.isStale(current)) return { ok: true, skipped: "fresh" };
  if (!navigator.onLine && !force) return { ok: false, skipped: "offline" };
  if (inFlight) return inFlight;

  const coins = [...new Set(store.recordsOfType("crypto").map((record) => record.coin).filter(Boolean))];

  inFlight = rates.refresh(current, { coins })
    .then(async ({ snapshot, problems, ok }) => {
      // Manual overrides are the owner's own numbers and always survive a refresh.
      snapshot.manual = { ...(current?.manual || {}), ...(snapshot.manual || {}) };
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
