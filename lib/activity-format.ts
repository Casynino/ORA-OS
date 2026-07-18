// Humanises raw activity-log rows into clean, executive-facing lines for the
// dashboards. Instead of "Rehema recorded expense EXP-C79C7S: TSh 600 — rent",
// the CEO sees a titled event ("Expense recorded") with a plain-language detail
// ("TSh 600 — rent") and who/when, with reference codes and the actor prefix
// stripped out. Derived purely from the stored row — no new data.

/** Clean, business-language title for each activity action. */
const ACTION_LABEL: Record<string, string> = {
  // Sales & collections (money in)
  FIELD_SALE_CONFIRMED: "Field sale confirmed",
  FIELD_SALE_CASH: "Cash sale recorded",
  FIELD_CREDIT_APPROVED: "Credit sale approved",
  FIELD_SALE_REJECTED: "Field sale rejected",
  FIELD_COLLECTION_CONFIRMED: "Collection confirmed",
  FIELD_COLLECTION_REJECTED: "Collection rejected",
  FIELD_CREDIT_COLLECTED: "Credit payment collected",
  PAYMENT_CONFIRMED: "Payment confirmed",
  PAYMENT_REJECTED: "Payment rejected",
  CASH_SALE_RECORDED: "Cash sale recorded",
  SETTLEMENT_CONFIRMED: "Settlement confirmed",
  SETTLEMENT_REJECTED: "Settlement rejected",
  CREDIT_PAYMENT_RECORDED: "Credit payment recorded",
  // Spending & capital (money out / capital)
  EXPENSE_RECORDED: "Expense recorded",
  EXPENSE_REMOVED: "Expense removed",
  CAPITAL_RECORDED: "Capital movement recorded",
  PAYROLL_PAID: "Payroll paid",
  // Operational fund
  OPERATIONAL_FUND_REQUESTED: "Operational funds requested",
  OPERATIONAL_FUND_APPROVED: "Operational funds approved",
  OPERATIONAL_FUND_REJECTED: "Operational funds rejected",
  OPERATIONAL_FUND_ISSUED: "Funds issued to Finance",
  OPERATIONAL_FUND_CONFIRMED: "Fund receipt confirmed",
  OPERATIONAL_FUND_ISSUE_CANCELLED: "Fund issue recalled",
  OPERATIONAL_EXPENSE_RECORDED: "Operational spend recorded",
  OPERATIONAL_EXPENSE_REMOVED: "Operational spend removed",
  PETTY_CASH_REQUESTED: "Operational funds requested",
  PETTY_CASH_APPROVED: "Operational funds approved",
  // People & partners
  EMPLOYEE_ADDED: "Employee added",
  AGENT_APPROVED: "Partner approved",
  AGENT_REJECTED: "Partner application rejected",
  USER_STATUS_CHANGED: "Account status changed",
  CREDIT_LIMIT_SET: "Credit limit set",
  CREDIT_TERMS_UPDATED: "Credit terms updated",
  CUSTOMER_UPDATED: "Customer updated",
  // Stock & returns
  REP_STOCK_PREPARED: "Rep stock prepared",
  RETURN_AUTHORISED: "Return authorised",
  FINANCE_RETURN_INITIATED: "Debt-recovery return started",
  RETURN_DEBT_RECOVERED: "Debt recovered via return",
  EXPENSE_CATEGORY_CREATED: "Expense category added",
};

// Whether an action represents money into or out of the business (for accenting).
const MONEY_IN = new Set([
  "FIELD_SALE_CONFIRMED", "FIELD_SALE_CASH", "FIELD_CREDIT_APPROVED",
  "FIELD_COLLECTION_CONFIRMED", "FIELD_CREDIT_COLLECTED", "PAYMENT_CONFIRMED",
  "CASH_SALE_RECORDED", "SETTLEMENT_CONFIRMED", "CREDIT_PAYMENT_RECORDED",
  "RETURN_DEBT_RECOVERED",
]);
const MONEY_OUT = new Set([
  "EXPENSE_RECORDED", "OPERATIONAL_EXPENSE_RECORDED", "PAYROLL_PAID",
  "OPERATIONAL_FUND_APPROVED", "OPERATIONAL_FUND_ISSUED",
]);

export type ActivityTone = "in" | "out" | "neutral";

export type HumanActivity = {
  title: string;
  detail: string;
  tone: ActivityTone;
};

/** Title-case a SCREAMING_SNAKE action as a fallback label. */
function humanizeAction(action: string): string {
  const s = action.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Reference codes like EXP-AB12CD, OF-9ZK2, CAP-5X49K3 — noise for a CEO feed.
const REF_CODE = /\b[A-Z]{2,4}-[A-Z0-9]{4,10}\b/;
// A parenthetical that contains a ref code, e.g. "(OF-9ZK2, 2 items)" — drop it all.
const REF_PAREN = /\s*\([^)]*[A-Z]{2,4}-[A-Z0-9]{4,10}[^)]*\)/g;

/** Strip the actor-name prefix, reference codes and leftover punctuation from a
 *  stored summary, leaving the human-meaningful part. */
function cleanDetail(summary: string, actorName: string | null): string {
  let s = summary.trim();
  if (actorName && s.toLowerCase().startsWith(actorName.toLowerCase())) {
    s = s.slice(actorName.length).trimStart();
  }
  s = s
    .replace(REF_PAREN, "") // "(OF-9ZK2, 2 items)" → gone
    .replace(new RegExp(REF_CODE.source, "g"), "") // bare codes
    .replace(/\(\s*\)/g, "") // empty parens left behind
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/[·—-]\s*[·—-]/g, "—")
    .replace(/^[\s:·—-]+/, "")
    .replace(/[\s:·—-]+$/, "")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turn one activity-log row into a clean, titled, executive-facing event. */
export function humanizeActivity(row: {
  action: string;
  summary: string;
  actorName?: string | null;
}): HumanActivity {
  const title = ACTION_LABEL[row.action] ?? humanizeAction(row.action);
  const detail = cleanDetail(row.summary, row.actorName ?? null);
  const tone: ActivityTone = MONEY_IN.has(row.action)
    ? "in"
    : MONEY_OUT.has(row.action)
      ? "out"
      : "neutral";
  return { title, detail, tone };
}
