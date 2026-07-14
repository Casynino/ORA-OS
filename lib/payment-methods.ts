// Shared labels + validation for receiving-account payment capture.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
};

/**
 * Resolve + validate a receiving account for a payment. Returns the derived
 * method label and account id (both null when no account was chosen — allowed
 * so payments keep flowing before the admin has configured any accounts).
 * Throws when the chosen account is unknown or deactivated.
 */
export async function resolveReceivingAccount(
  tx: Tx,
  paymentAccountId: string | null | undefined,
  fallbackMethod?: string | null,
): Promise<{ paymentAccountId: string | null; method: string | null }> {
  if (!paymentAccountId) {
    return { paymentAccountId: null, method: fallbackMethod?.trim() || null };
  }
  const account = await tx.paymentAccount.findUnique({
    where: { id: paymentAccountId },
  });
  if (!account) throw new Error("That receiving account no longer exists.");
  if (!account.isActive) {
    throw new Error(`"${account.name}" is deactivated — pick another account.`);
  }
  return {
    paymentAccountId: account.id,
    method: METHOD_LABEL[account.type] ?? account.type,
  };
}
