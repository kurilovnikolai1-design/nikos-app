/* Hash routing, so every screen has a real address.

   The old build swapped a CSS class and kept sixteen <h1> elements in the
   document at once. A view is now mounted only while it is on screen, which
   means back/forward work, a section can be linked to, and assistive
   technology is never offered fifteen hidden pages. */

export const VIEWS = ["command", "inbox", "tasks", "projects", "capital", "debts", "cashflow",
  "investments", "crypto", "assets", "health", "documents", "people", "decisions", "timeline", "settings"];

const listeners = new Set();
let current = "command";

export const onNavigate = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const currentView = () => current;

const normalise = (value) => (VIEWS.includes(value) ? value : "command");

export function navigate(view, { replace = false } = {}) {
  const target = normalise(view);
  const hash = `#/${target}`;
  if (location.hash === hash) { announce(target); return; }
  if (replace) history.replaceState(null, "", hash);
  else location.hash = hash;
}

function announce(view) {
  current = view;
  for (const fn of listeners) fn(view);
}

function fromHash() {
  return normalise(String(location.hash || "").replace(/^#\/?/, "").split("?")[0]);
}

export function initRouter() {
  window.addEventListener("hashchange", () => announce(fromHash()));
  current = fromHash();
  if (!location.hash) history.replaceState(null, "", "#/command");
  return current;
}
