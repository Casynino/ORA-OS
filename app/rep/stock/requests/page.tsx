import { redirect } from "next/navigation";

// Stock request history is now merged into the Request-stock page.
export default function RepStockRequestsRedirect() {
  redirect("/rep/stock/request");
}
