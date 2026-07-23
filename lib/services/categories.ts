import { prisma } from "@/lib/db";
import {
  PRESET_CATEGORY_OPTIONS,
  OPERATIONAL_FUND_PRESETS,
  OFFICE_FUND_CATEGORIES,
  type CategoryOption,
} from "@/lib/expense-categories";

/** Where the picker is used. "operational" narrows to the petty-cash categories
 *  the Operational Fund realistically covers (no stock purchases / salaries /
 *  imports) — keeping a fund allocation from ever being filed as capitalised
 *  stock, which would skew the P&L. "all" is every category (direct expenses). */
export type CategoryScope = "all" | "operational";

/** Every category a form may offer: the fixed presets + Finance/CEO-created
 *  custom categories (persisted, active). Customs roll up under their `group`
 *  enum but display their own name. Single source of truth for all pickers.
 *  Pass scope="operational" for Operational-Fund forms. */
export async function getSelectableCategories(
  scope: CategoryScope = "all",
): Promise<CategoryOption[]> {
  const allowed = scope === "operational" ? new Set(OFFICE_FUND_CATEGORIES) : null;

  // Operational Fund gets its own richer, Finance-worded preset list; every
  // other form keeps the plain enum-backed presets.
  const presets = allowed ? OPERATIONAL_FUND_PRESETS : PRESET_CATEGORY_OPTIONS;

  const customs = await prisma.expenseCategoryOption.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const custom: CategoryOption[] = customs
    .filter((c) => !allowed || allowed.has(c.group))
    .map((c) => ({
      value: `c:${c.id}`,
      label: c.name,
      category: c.group,
      customCategory: c.name,
      group: "Custom",
    }));
  return [...presets, ...custom];
}
