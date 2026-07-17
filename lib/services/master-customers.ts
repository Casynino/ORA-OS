import { prisma } from "@/lib/db";

/**
 * ORA's master customer database — partners AND rep-acquired field customers.
 * Shared by the admin and finance customer pages (both see everyone; reps are
 * scoped elsewhere to their own book).
 */
export async function getMasterCustomers() {
  const [partners, fieldCustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTNER" },
      orderBy: { createdAt: "desc" },
      include: { creditAccounts: true },
    }),
    prisma.fieldCustomer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        // Verified figures only — finance-approved field sales.
        sales: {
          where: { voided: false, financeStatus: "APPROVED" },
          select: { total: true, amountPaid: true, type: true },
        },
      },
    }),
  ]);
  return { partners, fieldCustomers };
}
