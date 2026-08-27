/* Copies that survive a mistake.
 *
 * The cloud protects against a lost phone. It does not protect against the
 * other way data disappears, which is a wrong action faithfully replicated
 * everywhere within seconds: a bad import, a bulk delete, a sync that
 * overwrote the good copy with the bad one. Undo covers one step; this covers
 * the case noticed a week later.
 *
 * Snapshots live in IndexedDB beside the vault — same origin, same storage
 * grant, no network, no key. That is deliberately the humblest possible
 * mechanism: whatever else fails, this does not depend on it.
 *
 * Kept small on purpose. A handful of dated copies, oldest dropped, so a year
 * of history never quietly consumes the space the live records need. */

import * as idb from "./idb.js?v=20260827-150530";

const PREFIX = "backup:";

/* Enough to reach back past the point where a mistake is usually noticed,
   without the copies costing more than the data. */
export const KEEP = 8;
export const EVERY_DAYS = 7;

const DAY = 86_400_000;
const stamp = (date = new Date()) => date.toISOString().slice(0, 19).replace(/[:T]/g, "-");

export async function listBackups() {
  if (!idb.isSupported()) return [];
  try {
    const keys = await idb.keys();
    return keys
      .filter((key) => String(key).startsWith(PREFIX))
      .map((key) => String(key))
      .sort()
      .reverse()
      .map((key) => ({ key, at: key.slice(PREFIX.length) }));
  } catch {
    return [];
  }
}

/* Write one copy and drop the oldest beyond KEEP. Returns what happened
   rather than throwing: a failed backup must never break a working app, but
   it must also never be mistaken for a successful one. */
export async function writeBackup(vault) {
  if (!idb.isSupported()) return { ok: false, reason: "no-storage" };

  const recordCount = Array.isArray(vault?.records) ? vault.records.length : 0;
  /* An empty vault is either a brand-new install or a catastrophe in
     progress. Either way it is the one thing not worth keeping a copy of,
     and keeping it would push a good copy out of the window. */
  if (!recordCount) return { ok: false, reason: "empty" };

  const key = PREFIX + stamp();
  try {
    await idb.put(key, { at: new Date().toISOString(), recordCount, vault });
  } catch (error) {
    return { ok: false, reason: "write-failed", error: String(error?.message || error) };
  }

  const all = await listBackups();
  for (const old of all.slice(KEEP)) {
    try { await idb.remove(old.key); } catch { /* the next sweep will get it */ }
  }

  return { ok: true, key, recordCount, kept: Math.min(all.length, KEEP) };
}

export async function readBackup(key) {
  if (!idb.isSupported()) return null;
  try { return (await idb.get(key)) ?? null; } catch { return null; }
}

export async function deleteBackup(key) {
  try { await idb.remove(key); } catch { /* already gone */ }
}

/* Whether a copy is owed. Time-based rather than change-based: a week during
   which nothing was edited is still a week in which the previous copy aged. */
export function isDue(lastBackupAt, { now = Date.now(), everyDays = EVERY_DAYS } = {}) {
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= everyDays * DAY;
}

export const BACKUP_NOTE = {
  ru: "Копии лежат на этом устройстве и не требуют ни интернета, ни ключа. Они защищают от ошибочного действия — облако защищает от потери телефона. Это разные вещи, и нужны обе.",
  en: "Copies are kept on this device and need neither a network nor a key. They protect against a wrong action; the cloud protects against a lost phone. Those are different risks and both are worth covering."
};
