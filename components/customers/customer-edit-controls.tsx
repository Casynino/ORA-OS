"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { updateFieldCustomer, deleteFieldCustomer } from "@/lib/actions/field";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { CUSTOMER_TYPES } from "@/lib/customer-types";

type EditableCustomer = {
  id: string;
  businessName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  region: string | null;
  district: string | null;
  customerType: string | null;
  expectedVolume: string | null;
  preferredPayment: string | null;
  businessLicense: string | null;
  taxId: string | null;
};

/** ADMIN/FINANCE edit controls for a field customer. Never rendered for a sales
 * rep. The registered address here is the customer's one delivery address.
 * Deletion is Admin-only (customers belong to ORA) — Finance sees Edit but not
 * Delete, gated by `canDelete`. */
export function CustomerEditControls({
  customer,
  listHref,
  hasSales,
  canDelete = false,
}: {
  customer: EditableCustomer;
  listHref: string;
  hasSales: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [del, startDelete] = useTransition();

  const [f, setF] = useState({
    businessName: customer.businessName ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    customerType: customer.customerType ?? "",
    preferredPayment: customer.preferredPayment ?? "",
    region: customer.region ?? "",
    district: customer.district ?? "",
    location: customer.location ?? "",
    expectedVolume: customer.expectedVolume ?? "",
    businessLicense: customer.businessLicense ?? "",
    taxId: customer.taxId ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function save() {
    if (f.businessName.trim().length < 2) {
      toast({ variant: "error", title: "Business name is required." });
      return;
    }
    start(async () => {
      const res = await updateFieldCustomer(customer.id, f);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setEditing(false);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  function remove() {
    startDelete(async () => {
      const res = await deleteFieldCustomer(customer.id);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push(listHref);
      } else {
        toast({ variant: "error", title: res.error });
        setConfirming(false);
      }
    });
  }

  const selectCls =
    "mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Manage customer
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit details
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Editing the address here updates this customer&apos;s single delivery address.
      </p>

      {editing && (
        <Modal open onClose={() => setEditing(false)} title={`Edit · ${customer.businessName}`}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Business / organisation name *</Label>
              <Input value={f.businessName} onChange={set("businessName")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={f.email} onChange={set("email")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={f.phone} onChange={set("phone")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Business type</Label>
              <select value={f.customerType} onChange={set("customerType")} className={selectCls}>
                <option value="">—</option>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preferred payment</Label>
              <select value={f.preferredPayment} onChange={set("preferredPayment")} className={selectCls}>
                <option value="">—</option>
                <option>Cash</option>
                <option>Credit</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Region</Label>
              <Input value={f.region} onChange={set("region")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">District</Label>
              <Input value={f.district} onChange={set("district")} className="mt-1 h-9" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Street / physical address (delivery address)</Label>
              <Input value={f.location} onChange={set("location")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expected monthly volume</Label>
              <Input value={f.expectedVolume} onChange={set("expectedVolume")} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Business licence</Label>
              <Input value={f.businessLicense} onChange={set("businessLicense")} className="mt-1 h-9" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Tax ID / TIN</Label>
              <Input value={f.taxId} onChange={set("taxId")} className="mt-1 h-9" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button>
            <Button className="rounded-full" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Modal>
      )}

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={`Delete ${customer.businessName}?`}
          description={
            hasSales
              ? "This customer has sales history, so they can't be deleted — suspend their credit instead."
              : "This permanently removes the customer. This can't be undone."
          }
        >
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={del || hasSales}
              onClick={remove}
            >
              {del ? "Deleting…" : "Delete customer"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
