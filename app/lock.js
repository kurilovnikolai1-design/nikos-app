/* PIN lock backed by real cryptography.

   Before this, every balance, diagnosis and document reference sat in
   localStorage as readable JSON: anyone who opened the laptop saw everything.
   Now the vault is AES-GCM encrypted with a key derived from the owner's PIN,
   and the key lives only in memory for the length of a session. */

const SUBTLE = globalThis.crypto?.subtle;
export const isSupported = () => Boolean(SUBTLE && globalThis.crypto?.getRandomValues);

const KDF_ITERATIONS = 250_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

async function deriveKey(pin, salt, iterations = KDF_ITERATIONS) {
  const material = await SUBTLE.importKey("raw", encoder.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
  return SUBTLE.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* An envelope carries everything needed to decrypt except the PIN itself. */
export async function seal(plaintext, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ciphertext = await SUBTLE.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext)
  };
}

/* Re-seal with an already derived key so saving does not re-run the KDF
   on every keystroke-sized change. */
export async function sealWithKey(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await SUBTLE.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return { v: 1, kdf: "PBKDF2-SHA256", iv: toBase64(iv), data: toBase64(ciphertext) };
}

export async function openEnvelope(envelope, pin) {
  const salt = fromBase64(envelope.salt);
  const key = await deriveKey(pin, salt, envelope.iterations || KDF_ITERATIONS);
  const plaintext = await unlockWithKey(envelope, key);
  return { plaintext, key, salt };
}

export async function unlockWithKey(envelope, key) {
  // AES-GCM is authenticated: a wrong key throws instead of returning garbage.
  const bytes = await SUBTLE.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.data)
  );
  return decoder.decode(bytes);
}

export const isEnvelope = (value) =>
  Boolean(value) && typeof value === "object" && value.v === 1 && typeof value.data === "string" && typeof value.iv === "string";

/* ---------- Session state ---------- */

let sessionKey = null;
let sessionSalt = null;
let lockedListeners = new Set();

export const onLockChange = (fn) => { lockedListeners.add(fn); return () => lockedListeners.delete(fn); };
const announce = (locked) => lockedListeners.forEach((fn) => fn(locked));

export const hasSessionKey = () => sessionKey !== null;
export const getSessionKey = () => sessionKey;
export const getSessionSalt = () => sessionSalt;

export function setSession(key, salt) {
  sessionKey = key;
  sessionSalt = salt;
  announce(false);
  resetIdleTimer();
}

export function clearSession() {
  sessionKey = null;
  sessionSalt = null;
  announce(true);
}

/* ---------- Auto-lock ---------- */

let idleTimer = null;
let idleMinutes = 15;
let idleHandler = null;

export function configureIdleLock(minutes, onIdle) {
  idleMinutes = Number(minutes) > 0 ? Number(minutes) : 0;
  idleHandler = onIdle;
  resetIdleTimer();
}

export function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (!idleMinutes || !sessionKey || !idleHandler) return;
  idleTimer = setTimeout(() => { if (sessionKey) idleHandler(); }, idleMinutes * 60_000);
}

export function watchActivity() {
  const events = ["pointerdown", "keydown", "visibilitychange"];
  for (const name of events) document.addEventListener(name, resetIdleTimer, { passive: true });
}

/* Rebuild the envelope header when re-sealing with the session key, so the
   salt survives even though sealWithKey does not carry it. */
export const withSalt = (envelope) => ({ ...envelope, kdf: "PBKDF2-SHA256", iterations: KDF_ITERATIONS, salt: toBase64(sessionSalt) });

export async function deriveFreshKey(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pin, salt);
  return { key, salt };
}

export async function selfTest() {
  if (!isSupported()) return ["WebCrypto недоступен"];
  const failures = [];
  const secret = JSON.stringify({ hello: "мир", amount: 12345 });
  const envelope = await seal(secret, "4821");
  if (envelope.data === secret) failures.push("данные не зашифрованы");
  try {
    const { plaintext } = await openEnvelope(envelope, "4821");
    if (plaintext !== secret) failures.push("расшифровка вернула не то");
  } catch { failures.push("правильный PIN не открыл хранилище"); }
  try {
    await openEnvelope(envelope, "0000");
    failures.push("неверный PIN открыл хранилище");
  } catch { /* expected */ }
  return failures;
}
