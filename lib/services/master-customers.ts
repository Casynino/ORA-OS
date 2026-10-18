import { prisma } from "@/lib/db";
import { notDeleted } from "@/lib/deleted-accounts";

/**
 * ORA's master customer database — partners AND rep-acquired field customers.
 * Shared by the admin and finance customer pages (both see everyone; reps are
 * scoped elsewhere to their own book).
 */
export async function getMasterCustomers() {
  const [partners, fieldCustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTNER", ...notDeleted },
      orderBy: { createdAt: "desc" },
      // These rows go to the browser — never include the password hash.
      omit: { passwordHash: true },
      include: { creditAccounts: true },
    }),
    prisma.fieldCustomer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        registeredBy: { select: { name: true } },
        // Live sales (excludes voided + finance-rejected). Lifetime/outstanding
        // are still computed from APPROVED only (verified figures), but PENDING
        // ones ride along so the table can flag "sale awaiting finance approval"
        // instead of a bare "—" that looks identical to no activity at all.
        // `isOpeningBalance` lets the table exclude migrated debt from lifetime
        // sales (revenue) while keeping it in outstanding.
        sales: {
          where: { voided: false, financeStatus: { not: "REJECTED" } },
          select: { total: true, amountPaid: true, type: true, financeStatus: true, isOpeningBalance: true },
        },
      },
    }),
  ]);
  return { partners, fieldCustomers };
}
