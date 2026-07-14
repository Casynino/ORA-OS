"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ReceivingAccount = {
  id: string;
  name: string;
  type: string; // CASH | BANK | MOBILE_MONEY
  details: string | null;
};

const METHODS: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash" },
  { key: "BANK", label: "Bank Transfer" },
  { key: "MOBILE_MONEY", label: "Mobile Money (Lipa)" },
];

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
};

/**
 * Method → receiving-account → reference capture, shared by every form that
 * records money in. When no accounts are configured yet, it falls back to a
 * plain method select so payments are never blocked.
 */
export function ReceivingAccountPicker({
  accounts,
  method,
  accountId,
  reference,
  onMethod,
  onAccount,
  onReference,
  compact = false,
}: {
  accounts: ReceivingAccount[];
  method: string;
  accountId: string;
  reference: string;
  onMethod: (v: string) => void;
  onAccount: (v: string) => void;
  onReference: (v: string) => void;
  compact?: boolean;
}) {
  const hasAccounts = accounts.length > 0;
  const forMethod = accounts.filter((a) => a.type === method);
  const h = compact ? "h-9" : "";

  if (!hasAccounts) {
    // Nothing configured yet — keep the classic free-text method choice.
    return (
      <div className={compact ? "" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <Label className="text-xs text-muted-foreground">Payment method</Label>
          <Select
            value={method || "CASH"}
            onChange={(e) => onMethod(e.target.value)}
            className={`mt-1 ${h}`}
          >
            {METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className={`grid gap-2.5 ${compact ? "" : "sm:grid-cols-2"}`}>
        <div>
          <Label className="text-xs text-muted-foreground">Payment method</Label>
          <Select
            value={method}
            onChange={(e) => {
              const next = e.target.value;
              onMethod(next);
              // auto-select the first account of the new method
              const first = accounts.find((a) => a.type === next);
              onAccount(first?.id ?? "");
            }}
            className={`mt-1 ${h}`}
          >
            {METHODS.map((m) => {
              const n = accounts.filter((a) => a.type === m.key).length;
              return (
                <option key={m.key} value={m.key} disabled={n === 0}>
                  {m.label}
                  {n === 0 ? " — no account set up" : ""}
                </option>
              );
            })}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Received into</Label>
          <Select
            value={accountId}
            onChange={(e) => onAccount(e.target.value)}
            className={`mt-1 ${h}`}
          >
            <option value="">Select account…</option>
            {forMethod.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.details ? ` · ${a.details}` : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
        <Input
          value={reference}
          onChange={(e) => onReference(e.target.value)}
          placeholder="Transaction ID / receipt no."
          className={`mt-1 ${h}`}
        />
      </div>
    </div>
  );
}
