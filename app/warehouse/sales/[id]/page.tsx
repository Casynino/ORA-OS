import { redirect } from "next/navigation";

// Sales records carry pricing — admin-only. The warehouse role is
// inventory-only, so old links land on the overview.
export default function WarehouseSaleDetailRemoved() {
  redirect("/warehouse");
}
