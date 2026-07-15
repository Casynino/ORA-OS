import { redirect } from "next/navigation";

// Sales are a business decision handled by the ORA admin team — the
// warehouse role is inventory-only. Old bookmarks land on the overview.
export default function WarehouseSalesRemoved() {
  redirect("/warehouse");
}
