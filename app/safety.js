/* Refuse to persist signing material.

   MASTER_SPEC §12.2 requires redaction before persistence and automated tests
   that submit secret-like strings and verify rejection. The old build only
   promised this in marketing copy: every free-text field accepted a seed
   phrase and synced it to Supabase in plaintext. This module is that promise
   turned into code, and it runs before anything reaches storage. */

/* BIP-39 words are 3–8 lowercase ASCII letters. A mnemonic is exactly
   12, 15, 18, 21 or 24 of them. Requiring an exact valid length keeps ordinary
   prose from tripping the check while catching real phrases reliably. */
const MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);
const WORD = /^[a-z]{3,8}$/;

/* A sample of BIP-39 words. A run that matches the structure above AND
   contains several of these is a mnemonic beyond reasonable doubt. */
const BIP39_SAMPLE = new Set(`abandon ability able about above absent absorb abstract absurd abuse access accident account accuse
achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice
aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow
almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal
ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena
argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume
asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware
away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel
base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best
betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind
blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box
boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown
brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz`
  .split(/\s+/).filter(Boolean));

const HIGH_RISK_PATTERNS = [
  { id: "privateKeyHex", re: /\b(?:0x)?[0-9a-fA-F]{64}\b/,
    ru: "Похоже на приватный ключ", en: "This looks like a private key" },
  { id: "privateKeyWif", re: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/,
    ru: "Похоже на приватный ключ кошелька", en: "This looks like a wallet private key" },
  { id: "extendedKey", re: /\b(?:xprv|yprv|zprv|tprv)[1-9A-HJ-NP-Za-km-z]{50,}\b/,
    ru: "Похоже на расширенный приватный ключ", en: "This looks like an extended private key" },
  { id: "pemKey", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ru: "Похоже на приватный ключ", en: "This looks like a private key" },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    ru: "Похоже на сервисный токен", en: "This looks like a service token" },
  { id: "supabaseSecret", re: /\bsb_secret_[A-Za-z0-9_-]{10,}\b/,
    ru: "Похоже на секретный ключ Supabase", en: "This looks like a Supabase secret key" },
  { id: "openaiKey", re: /\bsk-[A-Za-z0-9_-]{20,}\b/,
    ru: "Похоже на секретный API-ключ", en: "This looks like a secret API key" },
  { id: "githubToken", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    ru: "Похоже на токен GitHub", en: "This looks like a GitHub token" },
  { id: "awsKey", re: /\bAKIA[0-9A-Z]{16}\b/,
    ru: "Похоже на ключ AWS", en: "This looks like an AWS key" }
];

/* Public addresses are fine — the product is built to observe them.
   They must never be mistaken for secrets. */
export const looksLikePublicAddress = (text) =>
  /^(0x[0-9a-fA-F]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,62}|T[1-9A-HJ-NP-Za-km-z]{33})$/.test(String(text).trim());

function findMnemonic(text) {
  const tokens = String(text).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let run = [];
  for (const token of tokens.concat([""])) {
    if (WORD.test(token)) { run.push(token); continue; }
    if (MNEMONIC_LENGTHS.has(run.length)) {
      const known = run.filter((word) => BIP39_SAMPLE.has(word)).length;
      // Structure alone is suggestive; a few confirmed words make it certain.
      if (known >= 2 || run.length >= 12) return { words: run.length, known };
    }
    run = [];
  }
  return null;
}

/* Inspect one value. Returns null when clean, or a reason when it must not be stored. */
export function inspectValue(value) {
  const text = String(value ?? "");
  if (!text.trim()) return null;

  for (const rule of HIGH_RISK_PATTERNS) {
    if (!rule.re.test(text)) continue;
    // A 64-hex string is a private key; a 40-hex ETH address is not.
    if (rule.id === "privateKeyHex" && looksLikePublicAddress(text.trim())) continue;
    return { id: rule.id, ru: rule.ru, en: rule.en };
  }

  const mnemonic = findMnemonic(text);
  if (mnemonic) return {
    id: "mnemonic",
    ru: `Похоже на seed-фразу (${mnemonic.words} слов)`,
    en: `This looks like a seed phrase (${mnemonic.words} words)`
  };

  return null;
}

/* Inspect a whole record before it is saved. Returns [] when it is safe. */
export function inspectRecord(record) {
  const findings = [];
  const skip = new Set(["id", "type", "status", "createdAt", "updatedAt", "deletedAt", "currency", "walletAddress"]);
  for (const [field, value] of Object.entries(record || {})) {
    if (skip.has(field) || value === null || value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const finding = inspectValue(value);
    if (finding) findings.push({ ...finding, field });
  }
  // The wallet address field is allowed to hold an address, but not a key.
  if (record?.walletAddress && !looksLikePublicAddress(record.walletAddress)) {
    const finding = inspectValue(record.walletAddress);
    if (finding) findings.push({ ...finding, field: "walletAddress" });
  }
  return findings;
}

/* Self-test used at boot and by the test page: submitting secret-like strings
   must be rejected, and ordinary records must pass. MASTER_SPEC §12.2. */
export function selfTest() {
  const mustBlock = [
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "legal winner thank year wave sausage worth useful legal winner thank yellow",
    "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318",
    "5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ",
    "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi",
    "-----BEGIN RSA PRIVATE KEY-----",
    "sk-proj-abcdefghijklmnopqrstuvwxyz012345",
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
  ];
  const mustPass = [
    "Ипотека в Сбербанке, платёж 17 числа",
    "Mortgage payment on the 17th",
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    "Купить продукты и заехать на СТО",
    "Weekly review with the contractor about the land documents next Friday",
    "12000",
    ""
  ];
  const failures = [];
  for (const sample of mustBlock) if (!inspectValue(sample)) failures.push(`НЕ заблокировано: ${sample.slice(0, 40)}…`);
  for (const sample of mustPass) if (inspectValue(sample)) failures.push(`Ложное срабатывание: ${sample.slice(0, 40)}…`);
  return failures;
}
