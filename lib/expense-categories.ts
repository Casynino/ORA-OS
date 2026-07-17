import type { ExpenseCategory } from "@prisma/client";

// Client-safe expense-category constants — no server-only imports, so both
// server code (services/actions) and client components can share one source of
// truth for the labels, groupings and the office-fund short list.

/** Every ExpenseCategory enum value, for zod input validation. */
export const EXPENSE_CATEGORY_VALUES = [
  "RENT",
  "UTILITIES",
  "STATIONERY",
  "OFFICE",
  "SALARIES",
  "ALLOWANCES",
  "TRANSPORT_REIMBURSEMENT",
  "DELIVERY",
  "WAREHOUSE_HANDLING",
  "TRANSPORT_OF_GOODS",
  "STOCK_PURCHASE",
  "IMPORT_COSTS",
  "PACKAGING",
  "MARKETING",
  "TAXES",
  "INTERNET",
  "EQUIPMENT",
  "OTHER",
] as const;

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Office rent",
  UTILITIES: "Utilities",
  STATIONERY: "Stationery",
  OFFICE: "Office expenses",
  SALARIES: "Salaries",
  ALLOWANCES: "Rep allowances",
  TRANSPORT_REIMBURSEMENT: "Transport reimbursement",
  DELIVERY: "Delivery costs",
  WAREHOUSE_HANDLING: "Warehouse handling",
  TRANSPORT_OF_GOODS: "Transport of goods",
  STOCK_PURCHASE: "Stock purchase",
  IMPORT_COSTS: "Import costs",
  PACKAGING: "Packaging",
  MARKETING: "Marketing",
  TAXES: "Taxes",
  INTERNET: "Internet",
  EQUIPMENT: "Equipment",
  OTHER: "Miscellaneous",
};

export const EXPENSE_GROUPS: { label: string; categories: ExpenseCategory[] }[] = [
  { label: "Operational", categories: ["RENT", "UTILITIES", "STATIONERY", "OFFICE"] },
  { label: "Staff", categories: ["SALARIES", "ALLOWANCES", "TRANSPORT_REIMBURSEMENT"] },
  { label: "Logistics", categories: ["DELIVERY", "WAREHOUSE_HANDLING", "TRANSPORT_OF_GOODS"] },
  { label: "Business", categories: ["STOCK_PURCHASE", "IMPORT_COSTS", "PACKAGING", "MARKETING"] },
  { label: "Statutory & tech", categories: ["TAXES", "INTERNET", "EQUIPMENT"] },
  { label: "Other", categories: ["OTHER"] },
];

/**
 * The categories a day-to-day office fund realistically covers — this is the
 * short list finance picks from in the "Request office fund" form. It leaves
 * out salaries, stock purchases and import costs (those aren't petty office
 * spend), and OTHER catches anything not listed so finance can always file it.
 */
export const OFFICE_FUND_CATEGORIES: ExpenseCategory[] = [
  "OFFICE",
  "STATIONERY",
  "TRANSPORT_REIMBURSEMENT",
  "DELIVERY",
  "UTILITIES",
  "INTERNET",
  "RENT",
  "MARKETING",
  "PACKAGING",
  "EQUIPMENT",
  "OTHER",
];
