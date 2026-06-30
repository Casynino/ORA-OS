import "server-only";
import crypto from "crypto";

/**
 * NTZS payment rail (https://www.ntzs.co.tz/developers).
 *
 * Donations are collected by minting nTZS straight to the ORA platform
 * treasury (`collectToTreasury: true`). Each donor is registered as a
 * lightweight NTZS "payer" user purely so the deposit has an owner — the
 * donor never manages a wallet, and every shilling settles to our treasury.
 *
 * The secret API key lives only in NTZS_API_KEY (env). When it is absent the
 * helpers report "not configured" and the caller falls back to a no-payment
 * pledge, so the app keeps working without the integration.
 */

const API_URL = process.env.NTZS_API_URL || "https://www.ntzs.co.tz/api/v1";
const API_KEY = process.env.NTZS_API_KEY || "";
const WEBHOOK_SECRET = process.env.NTZS_WEBHOOK_SECRET || "";
// Single shared "ORA Donations" collection user. Every donation deposit is
// owned by this one NTZS user (funds still settle to the treasury via
// collectToTreasury), so donors never get their own wallet. It's an account
// identifier, not a secret; override via env if the collector is recreated.
const COLLECTOR_USER_ID =
  process.env.NTZS_TREASURY_USER_ID || "7821f20d-d2e1-40c5-98e0-d58e0577d29d";

export const MIN_DONATION_TZS = 500; // NTZS minimum collection amount
// Deposit statuses that mean the money has settled to the treasury.
export const NTZS_PAID_STATUSES = ["minted", "completed", "settled", "success"];

export function ntzsConfigured(): boolean {
  return API_KEY.length > 0;
}

/** The shared collection user id used to own every donation deposit. */
export function ntzsTreasuryUserId(): string | null {
  return COLLECTOR_USER_ID || null;
}

/** Normalise a Tanzanian mobile number to NTZS format: 2557XXXXXXXX. */
export function normalizeTzPhone(raw: string): string | null {
  const digits = (raw || "").replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("255")) {
    // keep
  } else if (n.startsWith("0")) {
    n = "255" + n.slice(1);
  } else if (n.length === 9 && /^[67]/.test(n)) {
    n = "255" + n;
  } else {
    return null;
  }
  return /^255[67]\d{8}$/.test(n) ? n : null;
}

async function ntzsFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: string } | null)?.message ||
      (json as { error?: string } | null)?.error ||
      text ||
      `NTZS request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export type NtzsUser = { id: string; walletAddress?: string };
export type NtzsDeposit = {
  id: string;
  status: string;
  amountTzs: number;
  paymentMethod: string;
  instructions?: string;
};

/** Register the donor as an NTZS payer user. Returns their NTZS user id. */
export function ntzsCreateUser(input: {
  externalId: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
}): Promise<NtzsUser> {
  return ntzsFetch<NtzsUser>("/users", {
    externalId: input.externalId,
    name: input.name,
    phone: input.phoneNumber,
    ...(input.email ? { email: input.email } : {}),
  });
}

export type NtzsDepositStatus = {
  id: string;
  status: string;
  amountTzs: number;
  txHash?: string | null;
};

/** Read a deposit's current status (used to confirm payments by polling). */
export async function ntzsGetDeposit(id: string): Promise<NtzsDepositStatus> {
  const res = await fetch(`${API_URL}/deposits/${id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NTZS deposit lookup failed (${res.status})`);
  return (await res.json()) as NtzsDepositStatus;
}

export function ntzsDepositPaid(status: string): boolean {
  return NTZS_PAID_STATUSES.includes((status || "").toLowerCase());
}

/** Start a mobile-money collection that settles to the ORA treasury. */
export function ntzsCreateTreasuryDeposit(input: {
  userId: string;
  amountTzs: number;
  phoneNumber: string;
}): Promise<NtzsDeposit> {
  return ntzsFetch<NtzsDeposit>("/deposits", {
    userId: input.userId,
    amountTzs: input.amountTzs,
    paymentMethod: "mobile_money",
    phoneNumber: input.phoneNumber,
    collectToTreasury: true,
  });
}

/**
 * Verify an NTZS webhook. The signature is HMAC-SHA256 over
 * `${timestamp}.${rawBody}` using the dashboard webhook secret.
 */
export function verifyNtzsWebhook(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  if (!WEBHOOK_SECRET || !timestamp || !signature) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
