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

/**
 * A pickable expense category — either a preset (backed by the enum) or a custom
 * one (persisted in ExpenseCategoryOption). Picking a custom stores its `group`
 * enum on the row + the custom `customCategory` name, so grouped reports still
 * aggregate it while every row shows the real name. Shared by the CategorySelect
 * picker and the category service.
 */
export type CategoryOption = {
  value: string; // unique key — the preset enum value, or `c:<id>` for a custom
  label: string;
  category: ExpenseCategory; // what gets stored on the row
  customCategory: string | null;
  group: string; // dropdown group heading
};

/** Preset categories as grouped picker options (client-safe — no DB). */
export const PRESET_CATEGORY_OPTIONS: CategoryOption[] = EXPENSE_GROUPS.flatMap((g) =>
  g.categories.map((c) => ({
    value: c,
    label: EXPENSE_LABELS[c],
    category: c,
    customCategory: null,
    group: g.label,
  })),
);

/** Build an Operational-Fund preset: its own name, stored against the enum it
 *  rolls up under (so P&L / grouped reports stay correct). */
const fundPreset = (
  label: string,
  category: ExpenseCategory,
  group: string,
): CategoryOption => ({
  value: `of:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  label,
  category,
  customCategory: label,
  group,
});

/**
 * The Operational Fund's own preset list — the spend Finance actually requests
 * week to week, named the way Finance names it.
 *
 * These are display presets: each carries its real name plus the
 * ExpenseCategory it rolls up under, using the very same mechanism as a
 * user-created custom category. That keeps the list as rich as Finance needs
 * without minting a new database enum value (and a risky migration) for every
 * line. Anything not listed is still covered by the picker's "+ New category…",
 * which persists the new name for future requests.
 *
 * Every `category` used here must stay inside OFFICE_FUND_CATEGORIES — that's
 * what the server validates a fund request against.
 */
export const OPERATIONAL_FUND_PRESETS: CategoryOption[] = [
  // Vehicle & travel
  fundPreset("Fuel", "DELIVERY", "Vehicle & travel"),
  fundPreset("Sales Team Travel & Field Allowance", "TRANSPORT_REIMBURSEMENT", "Vehicle & travel"),
  fundPreset("Parking Fees", "TRANSPORT_REIMBURSEMENT", "Vehicle & travel"),
  fundPreset("Vehicle Maintenance", "EQUIPMENT", "Vehicle & travel"),
  fundPreset("Police Fines / Traffic Fines", "OTHER", "Vehicle & travel"),
  // Delivery & logistics
  fundPreset("Regional Delivery Costs", "DELIVERY", "Delivery & logistics"),
  fundPreset("Courier Services", "DELIVERY", "Delivery & logistics"),
  fundPreset("Packaging Materials", "PACKAGING", "Delivery & logistics"),
  // Office
  fundPreset("Office Rent", "RENT", "Office"),
  fundPreset("Office Utilities", "UTILITIES", "Office"),
  fundPreset("Electricity", "UTILITIES", "Office"),
  fundPreset("Stationery & Office Supplies", "STATIONERY", "Office"),
  fundPreset("Office Refreshments", "OFFICE", "Office"),
  fundPreset("Cleaning Supplies", "OFFICE", "Office"),
  fundPreset("Staff Meals", "OFFICE", "Office"),
  // Tech & equipment
  fundPreset("Internet", "INTERNET", "Tech & equipment"),
  fundPreset("Equipment Repairs & Maintenance", "EQUIPMENT", "Tech & equipment"),
  // Marketing
  fundPreset("Marketing & Promotions", "MARKETING", "Marketing"),
  fundPreset("External Activities / Events", "MARKETING", "Marketing"),
  // Other
  fundPreset("Miscellaneous", "OTHER", "Other"),
];
