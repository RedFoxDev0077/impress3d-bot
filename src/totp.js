// Minimal TOTP (RFC 6238) — compatible with Google Authenticator / Authy.
// No external dependencies (uses Node crypto).
import crypto from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

export function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

export function totp(secret, forTime = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(forTime / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

// Verify with a ±1 step window (clock drift tolerance).
export function verifyTotp(secret, token) {
  const t = String(token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t) || !secret) return false;
  for (const w of [-1, 0, 1]) {
    if (totp(secret, Date.now() + w * 30000) === t) return true;
  }
  return false;
}

export function otpauthURL(secret, label = "Impress3D", issuer = "Impress3D Painel") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}
