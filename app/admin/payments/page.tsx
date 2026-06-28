import { redirect } from "next/navigation";

// Payment confirmation now happens inside each order (Orders → open an order).
// This standalone queue was removed; keep the route as a redirect.
export default function AdminPaymentsRedirect() {
  redirect("/admin/requests");
}
