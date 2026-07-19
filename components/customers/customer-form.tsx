"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFieldCustomer } from "@/lib/actions/field";
import { toast } from "@/components/ui/use-toast";
import { CUSTOMER_TYPES } from "@/lib/customer-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The single customer-registration form — used by reps, finance and admin.
 * Reps see the base profile fields; ADMIN/FINANCE additionally get a managing-rep
 * picker, a credit limit, and an opening-balance (existing debt) section. There
 * is no "simplified" variant — everyone captures the same complete profile.
 */
export function CustomerForm({
  startOpen = false,
  canAssignRep = false,
  canSetCreditLimit = false,
  canRecordOpeningBalance = false,
  reps = [],
  redirectTo,
  addLabel = "Add customer",
}: {
  startOpen?: boolean;
  canAssignRep?: boolean;
  canSetCreditLimit?: boolean;
  canRecordOpeningBalance?: boolean;
  reps?: { id: string; name: string }[];
  redirectTo?: string;
  addLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(startOpen);

  // ── Base profile fields (identical to the rep form) ──
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [preferredPayment, setPreferredPayment] = useState("");
  const [businessLicense, setBusinessLicense] = useState("");
  const [taxId, setTaxId] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  // ── ADMIN/FINANCE extras ──
  const [repId, setRepId] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creditStartDate, setCreditStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  function captureGps() {
    if (!navigator.geolocation) {
      toast({ variant: "error", title: "GPS isn't available on this device." });
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
        toast({ variant: "success", title: "GPS location captured." });
      },
      () => {
        setGpsBusy(false);
        toast({ variant: "error", title: "Couldn't get your location." });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function reset() {
    setBusinessName(""); setEmail(""); setPhone(""); setCustomerType("");
    setRegion(""); setDistrict(""); setLocation(""); setExpectedVolume("");
    setPreferredPayment(""); setBusinessLicense(""); setTaxId(""); setGps(null);
    setRepId(""); setCreditLimit(""); setOpeningBalance(""); setCreditStartDate(""); setDueDate("");
  }

  const obAmount = Number(openingBalance);
  const wantsOB = canRecordOpeningBalance && openingBalance.trim() !== "" && obAmount > 0;

  function submit() {
    if (businessName.trim().length < 2) {
      toast({ variant: "error", title: "Enter the customer's business name." });
      return;
    }
    if (wantsOB && !dueDate) {
      toast({ variant: "error", title: "Set a due date for the opening balance." });
      return;
    }
    start(async () => {
      const res = await createFieldCustomer({
        businessName, email, phone, location, region, district,
        customerType, expectedVolume, preferredPayment, businessLicense, taxId,
        gpsLat: gps?.lat, gpsLng: gps?.lng, notes: "",
        ...(canAssignRep ? { repId: repId || undefined } : {}),
        ...(canSetCreditLimit && creditLimit.trim() !== ""
          ? { creditLimit: Math.round(Number(creditLimit)) }
          : {}),
        ...(wantsOB
          ? { openingBalance: Math.round(obAmount), creditStartDate: creditStartDate || "", dueDate }
          : {}),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setOpen(false);
          reset();
          router.refresh();
        }
      } else toast({ variant: "error", title: res.error });
    });
  }

  if (!open)
    return (
      <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        {addLabel}
      </Button>
    );

  return (
    <div className="w-full space-y-3 rounded-xl border border-border p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Input placeholder="Business / organisation name *" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-9 sm:col-span-2" />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
        <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Business type…</option>
          {CUSTOMER_TYPES.map((t) => (<option key={t}>{t}</option>))}
        </select>
        <select value={preferredPayment} onChange={(e) => setPreferredPayment(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Preferred payment…</option>
          <option>Cash</option>
          <option>Credit</option>
        </select>
        <Input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-9" />
        <Input placeholder="District" value={district} onChange={(e) => setDistrict(e.target.value)} className="h-9" />
        <div className="sm:col-span-2">
          <Input placeholder="Street / physical address" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9" />
          <p className="mt-1 text-[11px] text-muted-foreground">This becomes their default delivery address.</p>
        </div>
        <Input placeholder="Expected monthly volume — e.g. 500 packs" value={expectedVolume} onChange={(e) => setExpectedVolume(e.target.value)} className="h-9" />
        <Input placeholder="Business licence (optional)" value={businessLicense} onChange={(e) => setBusinessLicense(e.target.value)} className="h-9" />
        <Input placeholder="Tax ID / TIN (optional)" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="h-9 sm:col-span-2" />
      </div>

      {(canAssignRep || canSetCreditLimit) && (
        <div className="grid gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-2">
          {canAssignRep && (
            <div>
              <label className="text-xs text-muted-foreground">Assigned sales rep</label>
              <select value={repId} onChange={(e) => setRepId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Unassigned — managed by Finance/Admin</option>
                {reps.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>
          )}
          {canSetCreditLimit && (
            <div>
              <label className="text-xs text-muted-foreground">Credit limit (TSh, optional)</label>
              <Input type="number" inputMode="numeric" min={0} placeholder="e.g. 500000" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="mt-1 h-9" />
            </div>
          )}
        </div>
      )}

      {canRecordOpeningBalance && (
        <div className="space-y-2.5 rounded-lg border border-warning/30 bg-warning/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Existing outstanding credit (opening balance)
          </p>
          <p className="text-[11px] text-muted-foreground">
            For customers who already owed ORA before ORA OS. It becomes a credit balance
            you can collect against — not a new sale. Leave blank if none.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Outstanding (TSh)</label>
              <Input type="number" inputMode="numeric" min={1} placeholder="e.g. 850000" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Credit start date</label>
              <Input type="date" value={creditStartDate} onChange={(e) => setCreditStartDate(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <label className={`text-xs ${wantsOB ? "text-foreground" : "text-muted-foreground"}`}>Due date{wantsOB ? " *" : ""}</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-9" />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={captureGps}
          disabled={gpsBusy}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            gps ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {gpsBusy ? "Getting GPS…" : gps ? "✓ GPS captured" : "Capture GPS location"}
        </button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" className="rounded-full" disabled={pending || businessName.trim().length < 2} onClick={submit}>
            {pending ? "Saving…" : "Save customer"}
          </Button>
          {!startOpen && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
