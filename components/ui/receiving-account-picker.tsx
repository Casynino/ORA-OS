"use client";

import { useEffect } from "react";
import { Banknote, Landmark, Smartphone, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ReceivingAccount = {
  id: string;
  name: string; // provider / location: "NMB Bank", "Voda", "Cash"
  type: string; // CASH | BANK | MOBILE_MONEY
  accountName: string | null; // holder, e.g. "ORA Sanitary Pads"
  accountNumber: string | null; // bank account no. / Lipa number
};

const METHODS: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash" },
  { key: "BANK", label: "Bank" },
  { key: "MOBILE_MONEY", label: "Mobile Money" },
  { key: "CHEQUE", label: "Cheque" },
];

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Cheque",
};

// A cheque isn't a company account — it's captured with its own details and
// verified by finance, so it's always selectable (never "not available").
const NO_ACCOUNT_METHODS = new Set(["CHEQUE"]);

const METHOD_ICON = {
  CASH: Banknote,
  BANK: Landmark,
  MOBILE_MONEY: Smartphone,
  CHEQUE: FileText,
} as const;

/**
 * The "where to pay" card — shows the payer exactly the essentials for the
 * selected account and nothing else (no internal finance configuration).
 */
export function PaymentDestination({ account }: { account: ReceivingAccount }) {
  const Icon =
    METHOD_ICON[account.type as keyof typeof METHOD_ICON] ?? Banknote;
  const numberLabel =
    account.type === "BANK"
      ? "Account"
      : account.type === "MOBILE_MONEY"
        ? "Lipa Number"
        : null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 text-sm leading-snug">
        {account.type === "CASH" ? (
          <>
            <p className="font-semibold">Cash Payment</p>
            {account.accountName && (
              <p className="text-muted-foreground">{account.accountName}</p>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold">{account.name}</p>
            {account.accountName && <p>{account.accountName}</p>}
            {numberLabel && account.accountNumber && (
              <p className="text-muted-foreground">
                {numberLabel}:{" "}
                <span className="font-semibold tracking-wide text-foreground">
                  {account.accountNumber}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Method → receiving-account → reference capture, shared by every form that
 * records money in. Kept deliberately simple for payers: pick Cash / Bank /
 * Mobile Money and see exactly where to pay. The account dropdown only
 * appears when a method has more than one company account. When no accounts
 * are configured yet, it falls back to a plain method select so payments are
 * never blocked.
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
  payerView = false,
}: {
  accounts: ReceivingAccount[];
  method: string;
  accountId: string;
  reference: string;
  onMethod: (v: string) => void;
  onAccount: (v: string) => void;
  onReference: (v: string) => void;
  compact?: boolean;
  /** Partner/payer wording ("Paid to") instead of admin wording ("Received into"). */
  payerView?: boolean;
}) {
  const hasAccounts = accounts.length > 0;
  const forMethod = accounts.filter((a) => a.type === method);
  const selected = forMethod.find((a) => a.id === accountId) ?? null;
  const h = compact ? "h-9" : "";

  // Keep the selection valid: whenever the chosen account doesn't belong to
  // the current method, snap to that method's first account. This also
  // handles initial state, so parents never need their own defaulting logic.
  useEffect(() => {
    if (!hasAccounts) return;
    if (!selected && forMethod.length > 0) onAccount(forMethod[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, accountId, accounts]);

  if (!hasAccounts) {
    // Nothing configured yet — keep the classic method choice + reference.
    return (
      <div className={compact ? "space-y-2.5" : "grid gap-3 sm:grid-cols-2"}>
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

  return (
    <div className="space-y-2.5">
      <div className={`grid gap-2.5 ${compact || forMethod.length < 2 ? "" : "sm:grid-cols-2"}`}>
        <div>
          <Label className="text-xs text-muted-foreground">Payment method</Label>
          <Select
            value={method}
            onChange={(e) => onMethod(e.target.value)}
            className={`mt-1 ${h}`}
          >
            {METHODS.map((m) => {
              const n = accounts.filter((a) => a.type === m.key).length;
              const noAccountNeeded = NO_ACCOUNT_METHODS.has(m.key);
              return (
                <option key={m.key} value={m.key} disabled={n === 0 && !noAccountNeeded}>
                  {m.label}
                  {n === 0 && !noAccountNeeded ? " — not available" : ""}
                </option>
              );
            })}
          </Select>
        </div>
        {forMethod.length > 1 && (
          <div>
            <Label className="text-xs text-muted-foreground">
              {payerView ? "Paid to" : "Received into"}
            </Label>
            <Select
              value={accountId}
              onChange={(e) => onAccount(e.target.value)}
              className={`mt-1 ${h}`}
            >
              {forMethod.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.accountNumber ? ` · ${a.accountNumber}` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {selected && <PaymentDestination account={selected} />}
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
