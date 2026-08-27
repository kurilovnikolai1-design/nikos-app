/* Record lifecycle: create, edit, confirm, archive, delete, restore.

   Two rules hold everywhere:
   1. Nothing is ever hard-deleted on the first action. MASTER_SPEC §7.3
      forbids destroying financial facts; the old build wiped them from
      localStorage and Supabase in one unconfirmed click.
   2. Nothing is saved until safety.inspectRecord() clears it. */

import * as store from "./store.js?v=20260827-085213";
import { inspectRecord } from "./safety.js?v=20260827-085213";
import { parseAmount } from "./money.js?v=20260827-085213";
import { TYPES, typeDef, categoriesOf, isVerified, COUNTS_AS_VERIFIED } from "./schema.js?v=20260827-085213";

export const TRASH_DAYS = 30;

export function blankRecord(type) {
  const def = typeDef(type) || TYPES.note;
  return {
    id: store.newId(type),
    type,
    category: def.categories[0]?.key || "other",
    name: "",
    counterparty: "",
    amountMinor: null,
    costBasisMinor: null,
    currency: store.getSettings().baseCurrency || "RUB",
    quantity: null,
    coin: "",
    walletAddress: "",
    value: null,
    unit: "",
    refLow: null,
    refHigh: null,
    duration: null,
    distance: null,
    intensity: null,
    feeling: null,
    date: today(),
    dueTime: "",
    dueDate: null,
    endDate: null,
    expiresAt: null,
    status: def.defaultStatus,
    priority: "medium",
    terms: "",
    rate: null,
    owner: "me",
    progress: null,
    ownershipPercent: null,
    source: "",
    confidence: "medium",
    reminderDate: null,
    linkedIds: [],
    recurring: false,
    frequency: "monthly",
    nextDueDate: null,
    contact: "",
    reasoning: "",
    details: "",
    attachment: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
}

export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/* ---------- Validation ---------- */

export function validate(record) {
  const def = typeDef(record.type);
  const errors = [];

  if (!String(record.name || "").trim() && record.type !== "measurement") {
    errors.push({ field: "name", key: "form.required" });
  }
  for (const field of def?.requires || []) {
    const value = field === "amount" ? record.amountMinor : record[field];
    if (value === null || value === undefined || String(value).trim() === "") {
      errors.push({ field, key: "form.required" });
    }
  }
  if ((record.type === "measurement" || record.type === "lab")
      && (record.value === null || record.value === undefined || record.value === "")) {
    errors.push({ field: "value", key: "form.required" });
  }
  if (record.ownershipPercent !== null && record.ownershipPercent !== undefined
      && (record.ownershipPercent < 0 || record.ownershipPercent > 100)) {
    errors.push({ field: "ownershipPercent", key: "form.required" });
  }

  const unsafe = inspectRecord(record);
  return { errors, unsafe };
}

/* ---------- Mutations ---------- */

export async function saveRecord(draft) {
  const record = {
    ...draft,
    name: String(draft.name || "").trim() || defaultName(draft),
    updatedAt: new Date().toISOString()
  };

  const { errors, unsafe } = validate(record);
  if (errors.length) return { ok: false, errors };
  if (unsafe.length) return { ok: false, unsafe };

  const existing = store.byId(record.id);
  const result = await store.commit((records) => {
    const index = records.findIndex((item) => item.id === record.id);
    if (index >= 0) records[index] = record;
    else records.push(record);
    return records;
  }, existing ? "record-updated" : "record-created");

  if (result.ok) {
    store.pushAudit({ action: existing ? "updated" : "created", type: record.type, recordId: record.id, name: record.name });
  }
  return { ...result, record };
}

function defaultName(record) {
  if (record.type === "measurement") {
    const category = categoriesOf("measurement").find((item) => item.key === record.category);
    return category ? category.ru : "Показатель";
  }
  return "—";
}

export async function confirmRecord(id) {
  const record = store.byId(id);
  if (!record) return { ok: false };
  const def = typeDef(record.type);
  // Move to whichever confirmed-like status this type actually supports.
  const target = ["confirmed", "active", "done", "paid"].find((status) => def?.statuses.includes(status)) || "confirmed";
  return patchRecord(id, { status: target }, "record-confirmed");
}

export async function confirmMany(ids) {
  const stamp = new Date().toISOString();
  const result = await store.commit((records) => records.map((record) => {
    if (!ids.includes(record.id)) return record;
    const def = typeDef(record.type);
    const target = ["confirmed", "active", "done", "paid"].find((status) => def?.statuses.includes(status)) || "confirmed";
    return { ...record, status: target, updatedAt: stamp };
  }), "record-confirmed");
  if (result.ok) store.pushAudit({ action: "confirmed", name: String(ids.length) });
  return result;
}

export async function patchRecord(id, patch, reason = "record-updated") {
  const stamp = new Date().toISOString();
  const record = store.byId(id);
  const result = await store.commit((records) =>
    records.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: stamp } : item)), reason);
  if (result.ok && record) {
    store.pushAudit({ action: reason.replace("record-", ""), type: record.type, recordId: id, name: record.name });
  }
  return result;
}

export const archiveRecord = (id) => patchRecord(id, { status: "archived" }, "record-archived");
export const unarchiveRecord = (id) => {
  const record = store.byId(id);
  const def = typeDef(record?.type);
  return patchRecord(id, { status: def?.defaultStatus || "unverified" }, "record-restored");
};

/* Soft delete: the record leaves every list but stays recoverable. */
export async function deleteRecord(id) {
  const record = store.byId(id);
  const result = await patchRecord(id, { deletedAt: new Date().toISOString() }, "record-deleted");
  return { ...result, record };
}

export const restoreRecord = (id) => patchRecord(id, { deletedAt: null }, "record-restored");

/* The only irreversible path, reached solely from Trash with a confirmation. */
export async function purgeRecord(id) {
  const record = store.byId(id);
  const result = await store.commit((records) => records.filter((item) => item.id !== id), "record-purged");
  if (result.ok && record) store.pushAudit({ action: "purged", type: record.type, recordId: id, name: record.name });
  return { ...result, record };
}

export async function purgeExpiredTrash() {
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const expired = store.allRecords().filter((record) => record.deletedAt && new Date(record.deletedAt).getTime() < cutoff);
  if (!expired.length) return { ok: true, purged: 0 };
  const ids = new Set(expired.map((record) => record.id));
  const result = await store.commit((records) => records.filter((record) => !ids.has(record.id)), "trash-expired");
  return { ...result, purged: expired.length };
}

/* ---------- Links ---------- */

export function linkedTo(record) {
  if (!record?.linkedIds?.length) return [];
  return record.linkedIds.map((id) => store.byId(id)).filter(Boolean);
}

export function backlinks(id) {
  return store.liveRecords().filter((record) => record.linkedIds?.includes(id));
}

/* ---------- Migration from the previous build ---------- */

const LEGACY_STATUS = {
  "needs confirmation": "unverified",
  needs_confirmation: "unverified",
  confirmed: "confirmed",
  active: "active",
  waiting: "waiting",
  paid: "paid",
  overdue: "overdue",
  archived: "archived"
};

const LEGACY_CATEGORY = {
  asset: { car: "car", land: "land", house: "house", apartment: "apartment", business: "business", other: "other" },
  expense: { mortgage: "mortgage", living: "living", business: "business", tax: "tax", interest: "other", other: "other" },
  income: { business: "business", salary: "salary", interest: "interest", rent: "rent", other: "other" },
  investment: { construction_project: "construction", jetlend: "jetlend", car_resale_deal: "car_resale",
                brokerage: "brokerage", business_investment: "business", other: "other" },
  account: { bank: "bank", brokerage: "brokerage", cash: "cash", business_account: "business" },
  receivable: { friend: "friend", car_reseller: "car_reseller", business: "business", other: "other" },
  payable: { mortgage: "mortgage", person: "person", business: "business", other: "other" },
  health: { checkup: "checkup", condition: "condition", routine: "routine", medication: "medication",
            fitness: "other", training: "other", other: "other" },
  document: { property: "property", finance: "finance", contract: "contract", other: "other" },
  person: { family: "family", business: "business", other: "other" },
  decision: { finance: "finance", property: "property", life: "life", other: "life" },
  event: { life: "life", finance: "finance", other: "other" },
  crypto: { wallet: "wallet", exchange: "exchange", other: "other" }
};

/* Old records could carry a type/category pair that no list rendered — the
   debt/"other" hole. Migration resolves every one of them into a real type. */
export function migrateRecord(old) {
  if (!old || typeof old !== "object") return null;
  if (old.amountMinor !== undefined || old.linkedIds !== undefined) return old; // already migrated

  let type = old.type;
  let category = old.category || "other";
  let note = "";

  if (type === "debt") {
    if (category === "receivable") { type = "receivable"; category = "other"; }
    else if (category === "payable") { type = "payable"; category = "other"; }
    else if (category === "mortgage") { type = "payable"; category = "mortgage"; }
    else {
      // Genuinely ambiguous. Keep it visible, keep it out of the arithmetic,
      // and say so, rather than guessing which side of the balance it belongs on.
      type = "payable"; category = "other";
      note = "⚠ Перенесено из старой записи «Долг · Другое». Укажите, вам должны или вы должны.";
    }
  } else if (type === "property") { type = "asset"; category = LEGACY_CATEGORY.asset[category] || "other"; }
  else if (type === "business") { type = "asset"; category = "business"; }
  else if (type === "privacy" || type === "integration") {
    type = "note"; category = "other";
    note = "Перенесено из настроек старой версии.";
  } else if (!TYPES[type]) { type = "note"; category = "other"; }

  if (TYPES[type] && LEGACY_CATEGORY[type]?.[old.category]) category = LEGACY_CATEGORY[type][old.category];
  if (!categoriesOf(type).some((item) => item.key === category)) category = categoriesOf(type)[0]?.key || "other";

  const base = blankRecord(type);
  const def = typeDef(type);
  let status = LEGACY_STATUS[old.status] || def.defaultStatus;
  if (!def.statuses.includes(status)) status = def.defaultStatus;
  if (note) status = def.statuses.includes("unverified") ? "unverified" : status;

  const currency = old.currency || "RUB";
  const details = [old.details, note].filter(Boolean).join("\n\n");

  return {
    ...base,
    id: old.id || store.newId(type),
    type,
    category,
    name: String(old.name || "—").slice(0, 200),
    counterparty: old.counterparty || "",
    amountMinor: old.amount === null || old.amount === undefined ? null : parseAmount(old.amount, currency),
    currency,
    date: normaliseDate(old.date),
    dueDate: normaliseDate(old.dueDate),
    status,
    priority: ["high", "medium", "low"].includes(old.priority) ? old.priority : "medium",
    terms: old.terms || "",
    owner: mapOwner(old.owner),
    source: old.source || "",
    confidence: ["high", "medium", "low"].includes(old.confidence) ? old.confidence : "medium",
    reminderDate: normaliseDate(old.reminderDate),
    linkedIds: old.linkedRecordId ? [old.linkedRecordId] : [],
    recurring: Boolean(old.recurring),
    frequency: old.frequency === "annual" ? "annual" : old.frequency || "monthly",
    nextDueDate: normaliseDate(old.nextDueDate),
    details,
    attachment: old.attachment || null,
    createdAt: old.createdAt || new Date().toISOString(),
    updatedAt: old.updatedAt || old.createdAt || new Date().toISOString(),
    deletedAt: null
  };
}

const normaliseDate = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

function mapOwner(value) {
  const text = String(value || "me").toLowerCase();
  if (text.includes("spouse") || text.includes("супруг")) return "spouse";
  if (text.includes("joint") || text.includes("совмест")) return "joint";
  if (text.includes("family") || text.includes("семь")) return "family";
  return "me";
}

export function migrateAll(records) {
  const migrated = [];
  for (const old of records || []) {
    const next = migrateRecord(old);
    if (next) migrated.push(next);
  }
  return migrated;
}

export { isVerified, COUNTS_AS_VERIFIED };
