// Carton/piece conversion — stock is stored internally in PIECES (the base unit).
// Cartons are a display + entry convenience: each product has its own
// `unitsPerCarton` (24 for pads/liners, 600 for a sample carton). Nothing in the
// system should ever multiply/divide cartons by a hard-coded number — always go
// through these helpers so a product's own carton size is respected.

export const DEFAULT_UNITS_PER_CARTON = 24;

/** Break a piece count into whole cartons + the loose remainder. */
export function splitQty(pieces: number, unitsPerCarton: number) {
  const upc = unitsPerCarton > 0 ? unitsPerCarton : DEFAULT_UNITS_PER_CARTON;
  const total = Math.max(0, Math.round(pieces));
  return {
    cartons: Math.floor(total / upc),
    pieces: total % upc,
    total,
  };
}

/** Whole + fractional cartons a piece count represents (e.g. 47,832 → 1,993). */
export function piecesToCartons(pieces: number, unitsPerCarton: number): number {
  const upc = unitsPerCarton > 0 ? unitsPerCarton : DEFAULT_UNITS_PER_CARTON;
  return (Math.max(0, Math.round(pieces))) / upc;
}

/** Combine a cartons + loose-pieces entry into a single piece total. */
export function combineToPieces(
  cartons: number,
  pieces: number,
  unitsPerCarton: number,
): number {
  const upc = unitsPerCarton > 0 ? unitsPerCarton : DEFAULT_UNITS_PER_CARTON;
  const c = Math.max(0, Math.floor(cartons || 0));
  const p = Math.max(0, Math.floor(pieces || 0));
  return c * upc + p;
}

const nf = new Intl.NumberFormat("en-US");

/**
 * Human label for a piece count, e.g. "1,993 cartons · 47,832 pcs" or
 * "42 cartons · 25,200 packs". `unit` is the singular piece noun.
 */
export function formatQty(
  pieces: number,
  unitsPerCarton: number,
  unit = "pc",
): string {
  const { cartons, pieces: loose, total } = splitQty(pieces, unitsPerCarton);
  const pcLabel = `${nf.format(total)} ${unit}${total === 1 ? "" : "s"}`;
  if (cartons === 0) return pcLabel;
  const cartonLabel = `${nf.format(cartons)} carton${cartons === 1 ? "" : "s"}`;
  if (loose === 0) return `${cartonLabel} · ${pcLabel}`;
  return `${cartonLabel} + ${nf.format(loose)} · ${pcLabel}`;
}

/** Short carton-only label, rounded to at most 1 dp (e.g. "1,993 cartons"). */
export function cartonLabel(pieces: number, unitsPerCarton: number): string {
  const cartons = piecesToCartons(pieces, unitsPerCarton);
  const rounded =
    Number.isInteger(cartons) ? cartons : Math.round(cartons * 10) / 10;
  return `${nf.format(rounded)} carton${rounded === 1 ? "" : "s"}`;
}
