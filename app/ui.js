/* DOM helpers, toasts and an accessible dialog.

   The old modals had no role, no aria-modal, no focus trap, no scroll lock and
   never returned focus. Keyboard and screen-reader users could tab straight
   into the page behind an open form, and on a phone the background scrolled
   under it. One implementation here fixes all of that in one place. */

import { t } from "./i18n.js?v=20260827-101457";

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of [children].flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clear = (node) => { while (node?.firstChild) node.firstChild.remove(); return node; };
export const mount = (node, ...children) => { clear(node); node.append(...children.flat().filter(Boolean)); return node; };

export const escapeHtml = (value = "") =>
  String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));

/* ---------- Toast ---------- */

let toastNode = null;
let toastTimer = null;

export function toast(message, { tone = "info", action = null, duration = 3200 } = {}) {
  if (!toastNode) {
    toastNode = el("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(toastNode);
  }
  clear(toastNode);
  toastNode.className = `toast tone-${tone}`;
  toastNode.append(el("span", { text: message }));
  if (action) {
    toastNode.append(el("button", {
      class: "toast-action", type: "button", text: action.label,
      onclick: () => { hideToast(); action.run(); }
    }));
  }
  toastNode.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? Math.max(duration, 6000) : duration);
}

export const hideToast = () => { toastNode?.classList.remove("show"); };

/* ---------- Dialog ---------- */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const openDialogs = [];

export function openDialog({ title, subtitle = "", body, footer = null, size = "", onClose = null, labelledBy = null }) {
  const returnFocusTo = document.activeElement;
  const titleId = `dlg-title-${Math.random().toString(36).slice(2, 8)}`;

  const closeButton = el("button", {
    class: "icon-button quiet dialog-close", type: "button",
    "aria-label": t("app.close"), text: "✕", onclick: () => close()
  });

  const head = el("div", { class: "dialog-head" }, [
    el("div", {}, [
      el("h2", { id: titleId, class: "dialog-title", text: title }),
      subtitle ? el("p", { class: "dialog-subtitle", text: subtitle }) : null
    ]),
    closeButton
  ]);

  const panel = el("div", {
    class: `dialog-panel ${size}`.trim(), role: "dialog", "aria-modal": "true",
    "aria-labelledby": labelledBy || titleId
  }, [head, el("div", { class: "dialog-body" }, [body]), footer ? el("div", { class: "dialog-footer" }, [footer]) : null]);

  const backdrop = el("div", { class: "dialog-backdrop" }, [panel]);

  backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = $$(FOCUSABLE, panel).filter((node) => node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    // Trap the ring so focus cannot escape into the page behind the dialog.
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  function close(result) {
    const index = openDialogs.indexOf(handle);
    if (index < 0) return;
    openDialogs.splice(index, 1);
    backdrop.remove();
    if (!openDialogs.length) document.body.classList.remove("dialog-open");
    onClose?.(result);
    // Send focus back where it came from, not to the top of the document.
    if (returnFocusTo?.isConnected) returnFocusTo.focus?.();
  }

  const handle = { close, panel, backdrop };
  openDialogs.push(handle);
  document.body.classList.add("dialog-open");
  document.body.append(backdrop);

  requestAnimationFrame(() => {
    const target = $("[data-autofocus]", panel) || $$(FOCUSABLE, panel)[0];
    target?.focus();
  });

  return handle;
}

export const closeTopDialog = () => openDialogs.at(-1)?.close();
export const hasOpenDialog = () => openDialogs.length > 0;

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openDialogs.length) {
    event.stopPropagation();
    closeTopDialog();
  }
}, true);

/* ---------- Confirm ---------- */

export function confirmDialog({ title, message, confirmLabel, tone = "default", detail = "" }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };

    const dialog = openDialog({
      title,
      size: "narrow",
      body: el("div", { class: "confirm-body" }, [
        el("p", { text: message }),
        detail ? el("p", { class: "confirm-detail", text: detail }) : null
      ]),
      footer: el("div", { class: "dialog-actions" }, [
        el("button", { class: "ghost-button", type: "button", text: t("app.cancel"), onclick: () => { finish(false); dialog.close(); } }),
        el("button", {
          class: tone === "danger" ? "primary-button danger" : "primary-button",
          type: "button", text: confirmLabel || t("app.confirm"), "data-autofocus": "true",
          onclick: () => { finish(true); dialog.close(); }
        })
      ]),
      onClose: () => finish(false)
    });
  });
}

/* ---------- Small building blocks shared by views ---------- */

export const panel = (className, ...children) =>
  el("section", { class: `panel ${className}`.trim() }, children.flat().filter(Boolean));

export const panelHeader = (kicker, title, right = null) =>
  el("div", { class: "panel-header" }, [
    el("div", {}, [kicker ? el("span", { class: "panel-kicker", text: kicker }) : null, el("h2", { text: title })]),
    right
  ]);

export const emptyState = (message, actionLabel = null, onAction = null) =>
  el("div", { class: "empty-state" }, [
    el("p", { text: message }),
    actionLabel && onAction ? el("button", { class: "text-button", type: "button", text: `${actionLabel} →`, onclick: onAction }) : null
  ]);

export const metricCard = ({ kicker, value, note, tone = "", onClick = null }) =>
  el(onClick ? "button" : "div", {
    class: `metric-card ${tone}`.trim(),
    type: onClick ? "button" : null,
    onclick: onClick || null
  }, [
    el("span", { class: "panel-kicker", text: kicker }),
    el("strong", { text: value }),
    note ? el("small", { text: note }) : null
  ]);

export const statusPill = (label, tone = "muted") =>
  el("span", { class: `status-pill tone-${tone}`, text: label });

export const spinner = () => el("span", { class: "spinner", "aria-hidden": "true" });
