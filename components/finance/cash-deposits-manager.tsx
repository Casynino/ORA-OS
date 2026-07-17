"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  CalendarDays,
  Landmark,
  Layers,
  ChevronDown,
  Banknote,
} from "lucide-react";
import { createCashDeposit } from "@/lib/actions/finance-approvals";
import type { CashOnHandItem, CashDepositRow } from "@/lib/services/cash";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProofUpload } from "@/components/ui/proof-upload";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";

type Account = { id: string; name: string; type: string; accountNumber: string | null };

function Tile({ icon: Icon, label, value, hint, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", accent)} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CashDepositsManager({
  onHand,
  items,
  deposits,
  accounts,
  readOnly = false,
}: {
  onHand: { total: number; today: number; week: number; count: number };
  items: CashOnHandItem[];
  deposits: CashDepositRow[];
  accounts: Account[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((a, i) => a + i.amount, 0);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Wallet} label="Cash on hand" value={formatCurrency(onHand.total)} hint="received, not yet banked" accent="text-warning" />
        <Tile icon={Banknote} label="Collected today" value={formatCurrency(onHand.today)} accent="text-success" />
        <Tile icon={CalendarDays} label="This week" value={formatCurrency(onHand.week)} accent="text-info" />
        <Tile icon={Layers} label="Awaiting deposit" value={formatNumber(onHand.count)} hint="cash collections" accent="text-primary" />
      </div>

      {/* Cash on hand list */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Cash waiting for deposit</h2>
          {!readOnly && selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selected.size} selected · <span className="font-semibold text-foreground">{formatCurrency(selectedTotal)}</span>
              </span>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Landmark className="size-4" /> Create bank deposit
              </Button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No cash on hand — all received cash has been banked.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {!readOnly && (
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-2 border-b border-border/60 px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40"
              >
                <input type="checkbox" readOnly checked={allSelected} className="size-4 accent-primary" />
                Select all ({items.length})
              </button>
            )}
            <ul className="divide-y divide-border/60">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  {!readOnly && (
                    <input
                      type="checkbox"
                      checked={selected.has(i.id)}
                      onChange={() => toggle(i.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{i.label}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{i.kind}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.saleCode} · {i.rep} · {timeAgo(i.receivedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 font-display font-semibold">{formatCurrency(i.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Deposit history */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Bank deposit history</h2>
        {deposits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No deposits recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {deposits.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display font-semibold">
                      {d.code}
                      <Badge variant="success" className="text-[10px]">{d.accountName}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(d.depositDate)} · {d.itemCount} collection{d.itemCount === 1 ? "" : "s"} · by {d.depositedBy}
                      {d.slipRef ? ` · slip ${d.slipRef}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold">{formatCurrency(d.total)}</span>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded === d.id && "rotate-180")} />
                  </div>
                </button>
                {expanded === d.id && (
                  <div className="border-t border-border/60 px-4 py-3">
                    {d.slipUrl && (
                      <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2">
                        <ProofViewer url={d.slipUrl} label="View deposit slip" />
                      </div>
                    )}
                    <ul className="space-y-1">
                      {d.lines.map((l, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-muted-foreground">
                            {l.saleCode} · {l.label}{" "}
                            <span className="text-[10px] uppercase">({l.kind})</span>
                          </span>
                          <span className="shrink-0 font-medium">{formatCurrency(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    {d.note && <p className="mt-2 text-xs text-muted-foreground">Note: {d.note}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <CreateDepositModal
          items={selectedItems}
          total={selectedTotal}
          accounts={accounts.filter((a) => a.type !== "CASH")}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateDepositModal({
  items,
  total,
  accounts,
  onClose,
  onDone,
}: {
  items: CashOnHandItem[];
  total: number;
  accounts: Account[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [depositDate, setDepositDate] = useState(today);
  const [slipRef, setSlipRef] = useState("");
  const [slipUrl, setSlipUrl] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!accountId) return toast({ variant: "error", title: "Choose the bank account you deposited into." });
    if (!depositDate) return toast({ variant: "error", title: "Pick the deposit date." });
    if (!slipUrl) return toast({ variant: "error", title: "Attach the deposit slip." });
    start(async () => {
      const res = await createCashDeposit({
        saleIds: items.filter((i) => i.kind === "sale").map((i) => i.id),
        paymentIds: items.filter((i) => i.kind === "collection").map((i) => i.id),
        depositAccountId: accountId,
        depositDate,
        slipUrl,
        slipRef: slipRef || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create bank deposit"
      description="Bank the selected cash together and attach the deposit slip. This moves it out of Cash on Hand."
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{items.length} collection{items.length === 1 ? "" : "s"}</span>
          <span className="float-right font-display text-lg font-semibold">{formatCurrency(total)}</span>
        </div>
        <div>
          <Label>Deposited into *</Label>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1.5">
            <option value="">Select bank / mobile account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.accountNumber ? ` · ${a.accountNumber}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Deposit date *</Label>
          <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>Deposit slip reference</Label>
          <Input value={slipRef} onChange={(e) => setSlipRef(e.target.value)} placeholder="Slip no. / bank reference" className="mt-1.5" />
        </div>
        <div>
          <Label className="mb-1.5 block">Deposit slip * — attach the bank slip</Label>
          <ProofUpload value={slipUrl} onChange={setSlipUrl} label="Attach deposit slip image" />
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth recording…" className="mt-1.5" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          <Landmark className="size-4" />
          {pending ? "Recording…" : `Bank ${formatCurrency(total)}`}
        </Button>
      </div>
    </Modal>
  );
}
