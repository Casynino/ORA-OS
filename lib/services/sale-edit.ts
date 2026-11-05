import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

export type EditableSaleFacts = {
  id: string;
  voided: boolean;
  financeStatus: string;
  directSale: boolean;
  isOpeningBalance: boolean;
  cashStatus: string | null;
  cashDepositId: string | null;
};

/** Why a rep CAN'T edit this sale right now — or null when they can.
 *
 *  A rep may edit their own sale at any stage, with these exceptions where money
 *  or goods have already moved on and a person must look first:
 *   - banked cash (Finance reverses the deposit first),
 *   - customer payments already posted on a credit sale (Finance rejects them first),
 *   - goods already returned on it (the rep undoes the return first),
 *   - a due-date extension request waiting for approval.
 *  Used by BOTH the edit page (to explain) and the edit action (to enforce, under
 *  the sale's row lock), so the two can never disagree. */
export async function saleEditBlocker(db: Db, sale: EditableSaleFacts): Promise<string | null> {
  if (sale.voided) return "This sale was voided, so it can't be edited.";
  if (sale.financeStatus === "REJECTED") {
    return "Finance rejected this sale and its stock is already back with you. Record the sale again with the right details.";
  }
  if (sale.directSale || sale.isOpeningBalance) {
    return "This kind of sale can't be edited here.";
  }
  if (sale.cashStatus === "DEPOSITED" || sale.cashDepositId) {
    return "This cash was already banked in a deposit. Ask Finance to reverse the deposit first, then edit the sale.";
  }
  const [payments, returns, extensions] = await Promise.all([
    db.fieldPayment.count({ where: { saleId: sale.id, financeStatus: { not: "REJECTED" } } }),
    db.returnRequest.count({ where: { fieldSaleId: sale.id, status: { not: "REJECTED" } } }),
    db.creditExtensionRequest.count({ where: { saleId: sale.id, status: "PENDING" } }),
  ]);
  if (payments > 0) {
    return "Customer payments are already recorded on this sale. Ask Finance to reject those first, then edit the sale.";
  }
  if (returns > 0) {
    return "Goods were already returned on this sale. Undo the return first, then edit the sale.";
  }
  if (extensions > 0) {
    return "A due-date extension request on this sale is waiting for approval. Wait for the decision, then edit the sale.";
  }
  return null;
}
