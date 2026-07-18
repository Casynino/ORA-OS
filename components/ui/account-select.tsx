"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

// Internal money-out / money-in attribution: the CEO names WHICH company
// account a movement draws from or lands in. Unlike the payer-facing
// ReceivingAccountPicker, this shows each account's live balance and has no
// "where to pay" card or reference — it's for capital, expenses and fund
// allocations, where the account is a real bank balance being moved.

export type SelectableAccount = {
  id: string;
  name: string; // "NMB Bank", "Voda", "Cash"
  type: string; // CASH | BANK | MOBILE_MONEY
  accountNumber?: string | null;
  balance?: number; // live balance (in − out); may be negative
};

const TYPE_GROUP: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash" },
  { key: "BANK", label: "Bank" },
  { key: "MOBILE_MONEY", label: "Mobile money" },
];

const NONE = "__none__";

export function CompanyAccountSelect({
  accounts,
  value,
  onChange,
  label = "From account",
  allowNone = false,
  noneLabel = "Cheque / other (no account)",
}: {
  accounts: SelectableAccount[];
  /** Account id, or "" for none. */
  value: string;
  onChange: (v: string) => void;
  label?: string;
  /** Adds a "no account" option (e.g. expenses paid by cheque / outside a tracked account). */
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const groups = TYPE_GROUP.map((g) => ({
    ...g,
    items: accounts.filter((a) => a.type === g.key),
  })).filter((g) => g.items.length > 0);
  const selected = accounts.find((a) => a.id === value) ?? null;

  // When a real account is required, default to the first one so the parent
  // never needs its own defaulting logic.
  useEffect(() => {
    if (allowNone) return;
    if (!selected && accounts.length > 0) onChange(accounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, accounts]);

  const optLabel = (a: SelectableAccount) => {
    const last4 = a.accountNumber ? ` · ····${a.accountNumber.slice(-4)}` : "";
    const bal = a.balance !== undefined ? ` · ${formatCurrency(a.balance)}` : "";
    return `${a.name}${last4}${bal}`;
  };

  if (accounts.length === 0 && !allowNone) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="mt-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          No company accounts configured — add one in Company accounts first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Label>{label}</Label>
      <Select
        value={value || (allowNone ? NONE : "")}
        onChange={(e) => onChange(e.target.value === NONE ? "" : e.target.value)}
        className="mt-1.5"
      >
        {allowNone && <option value={NONE}>{noneLabel}</option>}
        {groups.map((g) => (
          <optgroup key={g.key} label={g.label}>
            {g.items.map((a) => (
              <option key={a.id} value={a.id}>
                {optLabel(a)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      {selected && selected.balance !== undefined && (
        <p
          className={`mt-1 text-xs ${selected.balance < 0 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {selected.name} balance: {formatCurrency(selected.balance)}
          {selected.balance < 0 ? " — overdrawn in ORA's records" : ""}
        </p>
      )}
    </div>
  );
}
