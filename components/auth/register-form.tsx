"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Store } from "lucide-react";
import { registerAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-3 font-display text-xl font-semibold">
          Application received
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Apply as a partner — agent, distributor, NGO, school or retailer.
        </p>
      </div>

      {state && !state.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="organization">Business / organisation name</Label>
        <Input id="organization" name="organization" required className="mt-1.5" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" required className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label htmlFor="businessType">Business type</Label>
        <Select id="businessType" name="businessType" defaultValue="Agent" className="mt-1.5">
          <option>Agent</option>
          <option>Distributor</option>
          <option>NGO</option>
          <option>School</option>
          <option>Retail chain</option>
          <option>Other</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="region">Region</Label>
          <Input id="region" name="region" placeholder="e.g. Dar es Salaam" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="district">District</Label>
          <Input id="district" name="district" placeholder="e.g. Kinondoni" className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label htmlFor="street">Street / physical address</Label>
        <Input id="street" name="street" placeholder="Street, building, area" className="mt-1.5" />
        <p className="mt-1 text-xs text-muted-foreground">
          This becomes your default delivery address.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="expectedVolume">Expected monthly volume</Label>
          <Input
            id="expectedVolume"
            name="expectedVolume"
            placeholder="e.g. 500 packs"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="preferredPayment">Preferred payment</Label>
          <Select id="preferredPayment" name="preferredPayment" defaultValue="Cash" className="mt-1.5">
            <option>Cash</option>
            <option>Credit</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="businessLicense">Business licence (optional)</Label>
          <Input id="businessLicense" name="businessLicense" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="taxId">Tax ID / TIN (optional)</Label>
          <Input id="taxId" name="taxId" className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          At least 8 characters.
        </p>
      </div>

      <SubmitButton className="w-full" pendingText="Submitting…">
        Submit partner application
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        Partner accounts are activated after review by the ORA team.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
