import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Everything in the database that points at one user account, counted live from the
 * foreign keys themselves (so a table added later is included automatically).
 *
 * Used before deleting an account: with no records it can be erased completely; with records the
 * row has to stay (they point at it), so deleting only removes access. Hard-deleting such a row
 * would be destructive: the database would also wipe the rep's stock lines, partner prices and
 * credit history (CASCADE) and cut the link between activity-log lines and the person (SET NULL).
 */

/** Belongs only to the person (sign-in history, their inbox): goes with the account, not a "record". */
const PERSONAL = new Set(["LoginEvent.userId", "Notification.userId"]);

const LABEL: Record<string, string> = {
  ActivityLog: "activity log lines",
  Attachment: "files",
  CapitalEntry: "capital entries",
  CashDeposit: "cash deposits",
  ContactMessage: "messages",
  CreditAccount: "credit accounts",
  CreditExtensionRequest: "credit extensions",
  CycleLog: "cycle logs",
  Donation: "donations",
  EducationContent: "articles",
  Expense: "expenses",
  ExpenseCategoryOption: "expense categories",
  ExpenseClaim: "expense claims",
  FieldCustomer: "customers",
  FieldPayment: "field payments",
  FieldReport: "field reports",
  FieldSale: "sales",
  ImpactActivity: "impact activities",
  NewsPost: "news posts",
  OperationalSpend: "operational spends",
  PartnerCreditEvent: "credit events",
  PartnerPrice: "special prices",
  Payment: "payments",
  PayrollRun: "payroll runs",
  PettyCashExpense: "petty cash expenses",
  PettyCashRequest: "petty cash requests",
  RepStock: "stock lines held",
  RepStockIssue: "stock handed out",
  RepStockRequest: "stock requests",
  RepTarget: "targets",
  Request: "orders",
  ReturnRequest: "returns",
  SampleLog: "sample logs",
  SettlementRequest: "settlements",
  StockMovement: "stock movements",
  WarehouseTransfer: "stock transfers",
};

export type AccountRecords = { total: number; items: { label: string; count: number }[] };

type Db = Pick<Prisma.TransactionClient, "$queryRaw" | "$queryRawUnsafe">;

export async function accountRecords(db: Db, userId: string): Promise<AccountRecords> {
  const fks = await db.$queryRaw<{ tbl: string; col: string }[]>`
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass`;
  if (fks.length === 0) return { total: 0, items: [] };

  // The names come from the database catalog, never from a user; this only guards the shape.
  const parts = fks.map((f) => {
    if (!/^[A-Za-z0-9_."]+$/.test(f.tbl) || !/^[A-Za-z0-9_]+$/.test(f.col)) throw new Error("Unexpected table name.");
    const key = f.tbl.replace(/"/g, "");
    return `SELECT '${key}' AS t, '${f.col}' AS c, count(*)::int AS n FROM ${f.tbl} WHERE "${f.col}" = $1`;
  });
  const rows = await db.$queryRawUnsafe<{ t: string; c: string; n: number }[]>(parts.join(" UNION ALL "), userId);

  const byTable = new Map<string, number>();
  for (const r of rows) {
    if (r.n <= 0 || PERSONAL.has(`${r.t}.${r.c}`)) continue;
    byTable.set(r.t, (byTable.get(r.t) ?? 0) + r.n);
  }
  const items = [...byTable.entries()]
    .map(([t, count]) => ({ label: LABEL[t] ?? t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(), count }))
    .sort((a, b) => b.count - a.count);
  return { total: items.reduce((s, i) => s + i.count, 0), items };
}
