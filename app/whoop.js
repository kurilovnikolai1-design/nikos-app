/* The browser half of the WHOOP connection.

   All the sensitive work — holding the client secret, exchanging the code,
   refreshing tokens, verifying webhook signatures — happens in the Edge
   Function. This file only asks it to start, reports what it says, and offers
   a manual backfill. Nothing here can leak a credential, because nothing here
   ever sees one. */

import { el, toast, confirmDialog } from "./ui.js?v=20260827-104630";
import { t, getLocale, formatDate } from "./i18n.js?v=20260827-104630";
import * as cloud from "./cloud.js?v=20260827-104630";
import * as store from "./store.js?v=20260827-104630";

const ru = () => getLocale() === "ru";

const endpoint = (path) => {
  const base = cloud.functionsUrl("whoop");
  return base ? `${base}${path}` : null;
};

async function call(path, { method = "GET" } = {}) {
  const url = endpoint(path);
  if (!url) return { ok: false, reason: "no-project" };

  const token = await cloud.accessToken();
  if (!token) return { ok: false, reason: "not-signed-in" };

  try {
    const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, reason: "server", status: response.status, message: body?.error };
    return { ok: true, body };
  } catch (error) {
    return { ok: false, reason: "network", message: String(error?.message || error) };
  }
}

export const status = () => call("/status");

/* Sends the owner to WHOOP. The function builds the URL, because only it knows
   the client id and only it can register the one-time state. */
export async function connect() {
  const result = await call(`/connect?return_to=${encodeURIComponent(location.origin + location.pathname)}`);
  if (!result.ok) return result;
  if (!result.body?.url) return { ok: false, reason: "server" };
  location.href = result.body.url;
  return { ok: true };
}

export const syncAll = () => call("/sync?pages=60", { method: "POST" });

export function problemText(result) {
  if (result.reason === "no-project") {
    return ru() ? "Сначала подключите облачную синхронизацию — WHOOP пишет данные в неё."
                : "Connect cloud sync first — WHOOP writes into it.";
  }
  if (result.reason === "not-signed-in") {
    return ru() ? "Войдите в облачную синхронизацию, чтобы Nik'Os знал, чьи это данные."
                : "Sign in to cloud sync so Nik'Os knows whose data this is.";
  }
  if (result.reason === "network") {
    return ru() ? "Функция недоступна. Проверьте, что она развёрнута." : "The function is unreachable. Check that it is deployed.";
  }
  if (result.status === 404) {
    return ru() ? "WHOOP ещё не подключён." : "WHOOP is not connected yet.";
  }
  return result.message || (ru() ? "Не удалось связаться с WHOOP." : "Could not reach WHOOP.");
}

/* ---------- Settings row ---------- */

export function whoopRow(onChange) {
  const host = el("div", { class: "setting-row" });
  render({ loading: true });
  void refresh();
  return host;

  async function refresh() {
    const result = await status();
    if (!result.ok) { render({ problem: problemText(result), canRetry: result.reason === "server" }); return; }
    render({ connection: result.body });
  }

  function render(state) {
    const connected = state.connection?.connected;

    host.replaceChildren(
      el("span", { class: "setting-icon", "aria-hidden": "true", text: "♡" }),
      el("span", { class: "setting-copy" }, [
        el("strong", { text: "WHOOP" }),
        el("small", { text: state.loading
          ? (ru() ? "Проверяю…" : "Checking…")
          : connected
            ? [ru() ? "Подключено" : "Connected",
               state.connection.last_sync_at ? `${ru() ? "последняя синхронизация" : "last sync"} ${formatDate(state.connection.last_sync_at, "medium")}` : null
              ].filter(Boolean).join(" · ")
            : state.problem || (ru() ? "Сон, восстановление, HRV и тренировки — автоматически" : "Sleep, recovery, HRV and workouts — automatically") })
      ]),
      el("span", { class: "setting-control" }, [
        connected
          ? el("div", { class: "row-actions" }, [
              el("button", { class: "small-button", type: "button",
                             text: ru() ? "Загрузить историю" : "Backfill", onclick: backfill }),
              el("button", { class: "small-button", type: "button",
                             text: ru() ? "Обновить" : "Refresh", onclick: () => { render({ loading: true }); void refresh(); } })
            ])
          : el("button", {
              class: "primary-button", type: "button",
              disabled: state.loading || state.problem?.includes("синхрониз") || state.problem?.includes("cloud sync") ? true : null,
              text: ru() ? "Подключить" : "Connect",
              onclick: start
            })
      ])
    );
  }

  async function start() {
    const result = await connect();
    if (!result.ok) toast(problemText(result), { tone: "warn" });
  }

  async function backfill() {
    const ok = await confirmDialog({
      title: ru() ? "Загрузить всю историю" : "Backfill everything",
      message: ru()
        ? "Nik'Os заберёт из WHOOP весь сон, восстановление и тренировки за всё время. Это может занять минуту."
        : "Nik'Os will pull every sleep, recovery and workout from WHOOP. This can take a minute.",
      confirmLabel: ru() ? "Загрузить" : "Backfill"
    });
    if (!ok) return;

    toast(ru() ? "Загружаю из WHOOP…" : "Pulling from WHOOP…");
    const result = await syncAll();
    if (!result.ok) { toast(problemText(result), { tone: "danger" }); return; }

    await cloud.syncAll();
    toast(ru()
      ? `Загружено: ${result.body.saved} записей (сон ${result.body.sleeps}, восстановление ${result.body.recoveries}, тренировки ${result.body.workouts})`
      : `${result.body.saved} records pulled`, { tone: "success", duration: 7000 });
    onChange?.();
    void refresh();
  }
}

/* After WHOOP sends the owner back, the app lands on #/health?whoop=connected.
   Say so once, pull what is already there, and clean the address bar. */
export async function handleReturn(onChange) {
  if (!location.hash.includes("whoop=connected")) return;
  history.replaceState(null, "", location.pathname + "#/health");
  toast(ru() ? "WHOOP подключён. Забираю данные…" : "WHOOP connected. Pulling data…", { tone: "success" });

  const result = await syncAll();
  if (result.ok) {
    await cloud.syncAll();
    toast(ru() ? `Загружено записей: ${result.body.saved}` : `${result.body.saved} records pulled`, { tone: "success" });
    onChange?.();
  } else {
    toast(problemText(result), { tone: "warn" });
  }
}

export const isConfigured = () => Boolean(cloud.functionsUrl("whoop")) && store.getState().ready;
