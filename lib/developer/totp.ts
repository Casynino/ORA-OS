import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s) — the second factor for the
// Developer login. Compatible with Google Authenticator, Authy, 1Password, etc.
// No dependency; the shared secret lives ONLY in the DEV_TOTP_SECRET env var
// (never in source, never in the database), so a database leak alone can't mint
// a Developer session.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32-encoded (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUri(secret: string, account: string, issuer = "ORA OS"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin =
    ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Current code — used by tests/setup tooling, never shown to users. */
export function totpNow(secretB32: string, now = Date.now()): string {
  return hotp(base32Decode(secretB32), Math.floor(now / 30_000));
}

/** Verify a 6-digit code, allowing ±1 step (30s) of clock drift. Constant-time compare. */
export function verifyTotp(secretB32: string, code: string, now = Date.now()): boolean {
  const clean = (code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(secretB32);
  if (secret.length < 10) return false; // refuse a missing/garbage secret
  const step = Math.floor(now / 30_000);
  let ok = false;
  for (const delta of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, step + delta));
    const given = Buffer.from(clean);
    if (expected.length === given.length && timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}
