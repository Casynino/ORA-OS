import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Request access" };

export default function RequestAccessPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Request access
      </h1>
      <p className="mt-2 text-muted-foreground">
        Apply to join the ORA partner network — distributors, agents, NGOs,
        schools and retailers. Approved partners get controlled access to stock,
        pricing and fulfilment.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
