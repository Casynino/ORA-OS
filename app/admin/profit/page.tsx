import { redirect } from "next/navigation";

/** Profit lives inside Finance now (one bottom line, one source of truth).
 *  Old links land on the Finance › Profit & Loss tab. */
export default async function LegacyProfitRedirect({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  redirect(`/admin/finance/profit${period ? `?period=${period}` : ""}`);
}
