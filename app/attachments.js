/* Files that actually get kept.
 *
 * The form has offered "attach a file" since the first version, and until now
 * it stored the name, the size and the MIME type — and dropped the bytes on
 * the floor. A scan of a discharge summary became the string "выписка.pdf".
 * That is worse than having no field at all, because it looks like it worked.
 *
 * Bytes go into the same IndexedDB store as the vault, under a "file:" prefix.
 * Not a store of its own: a new store needs a version bump, and a failed
 * upgrade is one of the few ways to lose everything.
 *
 * Encryption follows the vault exactly. If a PIN is set and the session is
 * unlocked, the bytes are sealed with the same key before they are written; if
 * there is no PIN, they are written as they are. Files being readable when the
 * vault is not — or the reverse — would be a promise broken in one direction
 * or a nuisance in the other. */

import * as idb from "./idb.js?v=20260827-122205";
import * as lock from "./lock.js?v=20260827-122205";

const PREFIX = "file:";

/* Large enough for a scanned multi-page report, small enough that a mistaken
   video does not quietly consume the storage grant the records depend on. */
export const MAX_BYTES = 25 * 1024 * 1024;

export const RESULT = {
  OK: "ok",
  TOO_LARGE: "too-large",
  NO_STORAGE: "no-storage",
  FAILED: "failed"
};

const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ArrayBuffer <-> base64, needed because the vault's sealer speaks text.
   Chunked: String.fromCharCode(...bytes) throws on a large file. */
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* Store one file and return the descriptor that belongs on the record. */
export async function saveFile(file) {
  if (!file) return { result: RESULT.FAILED };
  if (file.size > MAX_BYTES) return { result: RESULT.TOO_LARGE, limit: MAX_BYTES };
  if (!idb.isSupported()) return { result: RESULT.NO_STORAGE };

  const id = newId();
  try {
    const buffer = await file.arrayBuffer();
    const key = lock.getSessionKey();

    /* Sealed when there is a key, plain otherwise — the same rule the vault
       follows, so the two can never disagree about who may read what. */
    const payload = key
      ? { sealed: true, envelope: await lock.sealWithKey(toBase64(buffer), key) }
      : { sealed: false, bytes: buffer };

    await idb.put(PREFIX + id, payload);

    return {
      result: RESULT.OK,
      attachment: {
        id,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        addedAt: new Date().toISOString(),
        sealed: Boolean(key)
      }
    };
  } catch (error) {
    /* A quota refusal must not leave a descriptor pointing at nothing. */
    try { await idb.remove(PREFIX + id); } catch { /* nothing to undo */ }
    return { result: RESULT.FAILED, error: String(error?.message || error) };
  }
}

/* The bytes back, as a Blob ready for an object URL. Returns null when the
   file is missing or still sealed with a key this session does not hold. */
export async function loadFile(attachment) {
  if (!attachment?.id || !idb.isSupported()) return null;

  try {
    const stored = await idb.get(PREFIX + attachment.id);
    if (!stored) return null;

    if (!stored.sealed) return new Blob([stored.bytes], { type: attachment.mime });

    const key = lock.getSessionKey();
    if (!key) return null;
    const base64 = await lock.unlockWithKey(stored.envelope, key);
    if (base64 === null || base64 === undefined) return null;
    return new Blob([fromBase64(base64)], { type: attachment.mime });
  } catch {
    return null;
  }
}

export async function deleteFile(attachment) {
  if (!attachment?.id) return;
  try { await idb.remove(PREFIX + attachment.id); } catch { /* already gone */ }
}

/* Files with no record pointing at them any more — deleting a record leaves
   its bytes behind, and on a phone that adds up quietly. */
export async function orphans(records) {
  if (!idb.isSupported()) return [];
  try {
    const referenced = new Set();
    for (const record of records) {
      if (record.attachment?.id) referenced.add(record.attachment.id);
    }
    const all = await idb.keys();
    return all
      .filter((key) => String(key).startsWith(PREFIX))
      .map((key) => String(key).slice(PREFIX.length))
      .filter((id) => !referenced.has(id));
  } catch {
    return [];
  }
}

export async function sweep(records) {
  const dead = await orphans(records);
  for (const id of dead) {
    try { await idb.remove(PREFIX + id); } catch { /* keep going */ }
  }
  return dead.length;
}

export function describeSize(bytes, locale = "ru") {
  if (!Number.isFinite(bytes)) return "";
  const units = locale === "ru" ? ["Б", "КБ", "МБ", "ГБ"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${String(rounded).replace(".", locale === "ru" ? "," : ".")} ${units[unit]}`;
}
