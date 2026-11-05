// Pure constants for a sales rep sending unsold stock back to the warehouse.
// Safe to import from client components (no database access here).
//
// A rep stock return is a normal ReturnRequest whose reasonType is the marker
// below, so it needs no schema change and flows through the same Returns queues
// (warehouse + admin) as every other return.

export const REP_RETURN_TYPE = "Rep stock return";

export const REP_RETURN_REASONS = [
  "Unsold stock",
  "Damaged",
  "Expired",
  "Wrong product",
  "Leaving the route",
  "Other",
] as const;

export type RepReturnReason = (typeof REP_RETURN_REASONS)[number];

export function isRepStockReturn(r: { reasonType: string | null }): boolean {
  return r.reasonType === REP_RETURN_TYPE;
}

// A customer sends goods back to the rep who sold them (credit customers, mostly).
// The rep starts it; Finance / Admin approve; on approval the pieces go back into
// the rep's stock and the value comes off what the customer owes.
export const CUSTOMER_RETURN_TYPE = "Customer return";

export function isCustomerReturn(r: { reasonType: string | null }): boolean {
  return r.reasonType === CUSTOMER_RETURN_TYPE;
}

export type ReturnKind = "REP_STOCK" | "CUSTOMER" | "OTHER";

export function returnKind(r: { reasonType: string | null }): ReturnKind {
  return isRepStockReturn(r) ? "REP_STOCK" : isCustomerReturn(r) ? "CUSTOMER" : "OTHER";
}
