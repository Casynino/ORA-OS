"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import {
  createPaymentAccount,
  updatePaymentAccount,
} from "@/lib/actions/payment-accounts";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const TYPE_OPTIONS = [
  { value: "CASH", label: "Cash (office / collection point)" },
  { value: "BANK", label: "Bank account" },
  { value: "MOBILE_MONEY", label: "Mobile money (Lipa number)" },
];

/** Field labels adapt to the account type so admin enters the right things. */
function fieldLabels(type: string) {
  if (type === "BANK") {
    return {
      name: "Bank name",
      namePh: "NMB Bank",
      holder: "Account name",
      holderPh: "ORA Sanitary Pads",
      number: "Account number",
      numberPh: "24110012629",
    };
  }
  if (type === "MOBILE_MONEY") {
    return {
      name: "Network",
      namePh: "Voda",
      holder: "Display name",
      holderPh: "ORA Sanitary Pads",
      number: "Lipa number",
      numberPh: "58198034",
    };
  }
  return {
    name: "Name",
    namePh: "Cash",
    holder: "Held by (optional)",
    holderPh: "Main office",
    number: "Location note (optional)",
    numberPh: "",
  };
}

export function AddAccountButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("CASH");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const L = fieldLabels(type);

  function submit() {
    start(async () => {
      const res = await createPaymentAccount({
        name,
        type: type as "CASH" | "BANK" | "MOBILE_MONEY",
        accountName,
        accountNumber,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setName("");
        setAccountName("");
        setAccountNumber("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add account
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Add receiving account"
          description="Where customer money lands — used across every sale and payment form."
        >
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5">
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{L.name}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={L.namePh}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{L.holder}</Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={L.holderPh}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{L.number}</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={L.numberPh}
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending || name.trim().length < 2}>
              {pending ? "Adding…" : "Add account"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AccountActions({
  account,
}: {
  account: {
    id: string;
    name: string;
    type: string;
    accountName: string | null;
    accountNumber: string | null;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [accountName, setAccountName] = useState(account.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(account.accountNumber ?? "");
  const L = fieldLabels(account.type);

  function save() {
    start(async () => {
      const res = await updatePaymentAccount({
        accountId: account.id,
        name,
        accountName,
        accountNumber,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }
  function toggle() {
    start(async () => {
      const res = await updatePaymentAccount({
        accountId: account.id,
        isActive: !account.isActive,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(true)} title="Edit">
        <Pencil className="size-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={`rounded-full text-xs ${account.isActive ? "text-muted-foreground hover:text-destructive" : "text-success"}`}
        disabled={pending}
        onClick={toggle}
      >
        {account.isActive ? "Deactivate" : "Activate"}
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={`Edit · ${account.name}`}>
          <div className="space-y-4">
            <div>
              <Label>{L.name}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>{L.holder}</Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={L.holderPh}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{L.number}</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={L.numberPh}
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={save} disabled={pending || name.trim().length < 2}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
