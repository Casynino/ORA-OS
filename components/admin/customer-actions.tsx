"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  CreditCard,
  KeyRound,
  Ban,
  RotateCcw,
  Phone,
  Mail,
} from "lucide-react";
import {
  updateCustomer,
  resetPartnerPassword,
  setCreditLimit,
  setUserStatus,
} from "@/lib/actions/users";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export type CustomerDTO = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  businessType: string | null;
  location: string | null;
  region: string | null;
  preferredPayment: string | null;
  paymentTerms: string | null;
  assignedWarehouse: string | null;
  notes: string | null;
  creditLimit: number | null;
  status: string;
};

type ModalKind = "edit" | "credit" | "password" | null;

export function CustomerActions({
  customer,
  warehouses,
}: {
  customer: CustomerDTO;
  warehouses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const refresh = () => router.refresh();
  const close = () => setModal(null);
  const suspended = customer.status === "SUSPENDED";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setModal("edit")}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setModal("credit")}>
          <CreditCard className="size-4" /> Credit limit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setModal("password")}>
          <KeyRound className="size-4" /> Reset password
        </Button>
        {suspended ? (
          <ActionButton
            size="sm"
            variant="success"
            confirm={`Reactivate ${customer.name}? They will be able to log in again.`}
            action={() => setUserStatus({ userId: customer.id, status: "ACTIVE" })}
            onDone={refresh}
          >
            <RotateCcw className="size-4" /> Reactivate
          </ActionButton>
        ) : (
          <ActionButton
            size="sm"
            variant="destructive"
            confirm={`Suspend ${customer.name}? They will be unable to log in. Existing records and active orders are kept.`}
            action={() => setUserStatus({ userId: customer.id, status: "SUSPENDED" })}
            onDone={refresh}
          >
            <Ban className="size-4" /> Suspend
          </ActionButton>
        )}
        {customer.phone && (
          <a
            href={`tel:${customer.phone.replace(/\s+/g, "")}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <Phone className="size-4" /> Call
          </a>
        )}
        <a
          href={`mailto:${customer.email}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          <Mail className="size-4" /> Email
        </a>
      </div>

      {modal === "edit" && (
        <EditModal customer={customer} warehouses={warehouses} onClose={close} onDone={() => { close(); refresh(); }} />
      )}
      {modal === "credit" && (
        <CreditModal customer={customer} onClose={close} onDone={() => { close(); refresh(); }} />
      )}
      {modal === "password" && (
        <PasswordModal customer={customer} onClose={close} onDone={() => { close(); refresh(); }} />
      )}
    </>
  );
}

function EditModal({ customer, warehouses, onClose, onDone }: { customer: CustomerDTO; warehouses: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    organization: customer.organization ?? "",
    businessType: customer.businessType ?? "",
    location: customer.location ?? "",
    region: customer.region ?? "",
    preferredPayment: customer.preferredPayment ?? "",
    paymentTerms: customer.paymentTerms ?? "",
    assignedWarehouse: customer.assignedWarehouse ?? "",
    notes: customer.notes ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    start(async () => {
      const res = await updateCustomer({ userId: customer.id, ...f });
      if (res.ok) { toast({ variant: "success", title: res.message }); onDone(); }
      else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal open onClose={onClose} title="Edit customer">
      <div className="space-y-3">
        <Field label="Business / contact name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+255…" /></Field>
        </div>
        <Field label="Organization"><Input value={f.organization} onChange={(e) => set("organization", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Partner type">
            <Select value={f.businessType} onChange={(e) => set("businessType", e.target.value)}>
              <option value="">—</option>
              <option>Agent</option>
              <option>Distributor</option>
              <option>Retailer</option>
              <option>NGO</option>
              <option>School</option>
            </Select>
          </Field>
          <Field label="Preferred payment">
            <Select value={f.preferredPayment} onChange={(e) => set("preferredPayment", e.target.value)}>
              <option value="">—</option>
              <option>Cash</option>
              <option>Credit</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location"><Input value={f.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Region"><Input value={f.region} onChange={(e) => set("region", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment terms"><Input value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="e.g. Net 30" /></Field>
          <Field label="Fulfilling warehouse">
            <Select value={f.assignedWarehouse} onChange={(e) => set("assignedWarehouse", e.target.value)}>
              <option value="">Main warehouse (default)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Internal notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Button className="w-full" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function CreditModal({ customer, onClose, onDone }: { customer: CustomerDTO; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [limit, setLimit] = useState(String(customer.creditLimit ?? 0));
  function submit() {
    start(async () => {
      const res = await setCreditLimit({ userId: customer.id, creditLimit: Number(limit) || 0 });
      if (res.ok) { toast({ variant: "success", title: res.message }); onDone(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <Modal open onClose={onClose} title={`Credit limit · ${customer.name}`} description="The maximum a partner can owe on credit at any time.">
      <div className="space-y-4">
        <Field label="Credit limit (TSh)"><Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
        <Button className="w-full" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Update credit limit"}</Button>
      </div>
    </Modal>
  );
}

function PasswordModal({ customer, onClose, onDone }: { customer: CustomerDTO; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  function submit() {
    start(async () => {
      const res = await resetPartnerPassword({ userId: customer.id, password: pw });
      if (res.ok) { toast({ variant: "success", title: res.message }); onDone(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <Modal open onClose={onClose} title={`Reset password · ${customer.name}`} description="Set a new password and share it securely with the partner.">
      <div className="space-y-4">
        <Field label="New password"><Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></Field>
        <Button className="w-full" onClick={submit} disabled={pending || pw.length < 8}>{pending ? "Saving…" : "Set new password"}</Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
