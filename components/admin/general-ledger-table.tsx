"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, ArrowUpDown, ExternalLink, ScrollText } from "lucide-react";
import type { LedgerEntry } from "@/lib/services/finance";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// Friendly, executive-facing names for each movement kind.
const KIND_LABEL: Record<LedgerEntry["kind"], string> = {
  SALE: "Sale",
  CREDIT_COLLECTED: "Credit payment",
  FIELD_SALE: "Field sale",
  FIELD_COLLECTION: "Field collection",
  EXPENSE: "Expense",
  CAPITAL: "Capital",
};

type SortKey = "date" | "amount";

/**
 * The General Ledger — ORA's full accounting register as a live, filterable
 * table. Every money movement (sales, collections, expenses, capital) with its
 * debit/credit, the account it moved through, who recorded it, a running balance
 * and a link to the source document. Search, filter, sort and export to PDF.
 * Derived entirely from real records — it can never drift.
 */
export function GeneralLedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("all");
  const [account, setAccount] = useState("all");
  const [direction, setDirection] = useState("all");
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Distinct option lists derived from the rows themselves — always in sync.
  const accountOptions = useMemo(
    () => [...new Set(rows.map((r) => r.accountName).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const categoryOptions = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(),
    [rows],
  );
  const actorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.actor).filter(Boolean) as string[])].sort(),
    [rows],
  );

  // Running balance is always chronological (oldest→newest), so each row shows
  // the cumulative net up to and including it — regardless of the display sort.
  const balanceById = useMemo(() => {
    const map = new Map<string, number>();
    let bal = 0;
    for (const r of [...rows].sort((a, b) => a.date.getTime() - b.date.getTime())) {
      bal += r.amount;
      map.set(r.id, bal);
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const list = rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (account !== "all" && (account === "__none__" ? r.accountName != null : r.accountName !== account)) return false;
      if (category !== "all" && r.category !== category) return false;
      if (actor !== "all" && r.actor !== actor) return false;
      if (direction === "in" && r.amount < 0) return false;
      if (direction === "out" && r.amount >= 0) return false;
      const t = r.date.getTime();
      if (t < fromTime || t > toTime) return false;
      if (q) {
        const hay = `${r.label} ${r.reference} ${r.category} ${r.accountName ?? ""} ${r.actor ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      const v = sortKey === "date" ? a.date.getTime() - b.date.getTime() : a.amount - b.amount;
      return sortDir === "asc" ? v : -v;
    });
    return list;
  }, [rows, search, from, to, kind, account, category, actor, direction, sortKey, sortDir]);

  const totals = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const r of filtered) {
      if (r.amount >= 0) inSum += r.amount;
      else outSum += -r.amount;
    }
    return { inSum, outSum, net: inSum - outSum };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  }

  function resetFilters() {
    setSearch(""); setFrom(""); setTo(""); setKind("all");
    setAccount("all"); setDirection("all"); setCategory("all"); setActor("all");
  }

  async function exportPdf() {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("ORA — General Ledger", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `${filtered.length} transactions · In ${formatCurrency(totals.inSum)} · Out ${formatCurrency(totals.outSum)} · Net ${formatCurrency(totals.net)}`,
      14,
      21,
    );
    autoTable(doc, {
      startY: 25,
      head: [["Date", "Description", "Type", "Category", "Account", "By", "Debit (out)", "Credit (in)", "Balance"]],
      body: filtered.map((r) => [
        formatDate(r.date),
        `${r.label} (${r.reference})`,
        KIND_LABEL[r.kind],
        r.category,
        r.accountName ?? "—",
        r.actor ?? "—",
        r.amount < 0 ? formatCurrency(-r.amount) : "",
        r.amount >= 0 ? formatCurrency(r.amount) : "",
        formatCurrency(balanceById.get(r.id) ?? 0),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [190, 24, 93], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 244, 248] },
      columnStyles: {
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`ora-general-ledger-${stamp}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, reference, account, person…"
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={exportPdf} disabled={filtered.length === 0}>
              <Download className="size-4" /> Export PDF
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
              <option value="all">All types</option>
              {(Object.keys(KIND_LABEL) as LedgerEntry["kind"][]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
            <Select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction">
              <option value="all">In &amp; out</option>
              <option value="in">Money in</option>
              <option value="out">Money out</option>
            </Select>
            <Select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account">
              <option value="all">All accounts</option>
              {accountOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              <option value="__none__">No account</option>
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Recorded by">
              <option value="all">Anyone</option>
              {actorOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 lg:col-span-1">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "movement" : "movements"}
          {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="text-success">In <span className="font-semibold">{formatCurrency(totals.inSum)}</span></span>
          <span className="text-destructive">Out <span className="font-semibold">{formatCurrency(totals.outSum)}</span></span>
          <span>Net <span className={cn("font-semibold", totals.net >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(totals.net)}</span></span>
          {(search || from || to || kind !== "all" || account !== "all" || direction !== "all" || category !== "all" || actor !== "all") && (
            <button onClick={resetFilters} className="text-muted-foreground underline-offset-2 hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* Register */}
      {filtered.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-14"
          icon={ScrollText}
          title="No transactions match"
          description="Try widening the date range or clearing filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">
                  <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Date <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">By</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Debit <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold">Credit</th>
                <th className="px-4 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const bal = balanceById.get(r.id) ?? 0;
                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.label}</span>
                        <Badge variant={r.amount >= 0 ? "success" : "destructive"} className="shrink-0">
                          {KIND_LABEL[r.kind]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.linkedHref ? (
                          <Link href={r.linkedHref} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                            {r.reference} <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          r.reference
                        )}
                        {r.method ? ` · ${r.method}` : ""}
                      </div>
                      {r.proofUrl && (
                        <div className="mt-1">
                          <ProofViewer url={r.proofUrl} label="Payment proof" compact />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{r.category}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.accountName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.actor ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-destructive">
                      {r.amount < 0 ? formatCurrency(-r.amount) : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-success">
                      {r.amount >= 0 ? formatCurrency(r.amount) : ""}
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right font-semibold", bal >= 0 ? "text-foreground" : "text-destructive")}>
                      {formatCurrency(bal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
