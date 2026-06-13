const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_ISSUER = "EdgeKey";
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_WINDOW = 1;

export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
};

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string) {
  const normalized = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error("INVALID_BASE32_SECRET");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

function toCounterBuffer(counter: number) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);
  return buffer;
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function hmacSha1(secret: Uint8Array, counter: number) {
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, toCounterBuffer(counter));
  return new Uint8Array(signature);
}

async function generateCode(secret: string, counter: number, digits = DEFAULT_DIGITS) {
  const hmac = await hmacSha1(base32Decode(secret), counter);
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function generateTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export function buildTotpSetup(username: string, secret = generateTotpSecret()): TotpSetup {
  const issuer = DEFAULT_ISSUER;
  const account = username || "admin";
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_PERIOD),
  });

  return {
    secret,
    otpauthUrl: `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`,
  };
}

export async function verifyTotpCode(input: { secret: string; code: string; now?: number; window?: number }) {
  const code = input.code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const now = input.now ?? Date.now();
  const step = Math.floor(now / 1000 / DEFAULT_PERIOD);
  const window = input.window ?? DEFAULT_WINDOW;

  for (let drift = -window; drift <= window; drift += 1) {
    const expected = await generateCode(input.secret, step + drift);
    if (expected === code) {
      return true;
    }
  }

  return false;
}
