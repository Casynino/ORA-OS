"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, ChevronRight, BadgeCheck, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

type PartnerRow = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  location: string | null;
  status: string;
  creditLimit: number | null;
  creditAccounts: { status: string; principal: number; amountPaid: number }[];
  /** Where this row opens — computed server-side so each role can route its own way. */
  href: string;
};

type FieldRow = {
  id: string;
  name: string;
  businessName: string | null;
  customerType: string | null;
  phone: string | null;
  location: string | null;
  region: string | null;
  creditSuspended: boolean;
  createdAt: Date;
  rep: { id: string; name: string } | null;
  registeredBy?: { name: string } | null;
  sales: { total: number; amountPaid: number; type: string; financeStatus: string; isOpeningBalance: boolean }[];
  href: string;
};

const hay = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(" ").toLowerCase();

/** Master customer tables (partners + field customers), searchable across the
 *  whole ORA book. Row links are computed by the caller so admin and finance
 *  can each point at their own routes. */
export function MasterCustomersTables({
  partners,
  fieldCustomers,
  repHrefBase,
}: {
  partners: PartnerRow[];
  fieldCustomers: FieldRow[];
  /** e.g. "/admin/reps" — omit to render rep names as plain text. */
  repHrefBase?: string;
}) {
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const shownPartners = useMemo(
    () =>
      !needle
        ? partners
        : partners.filter((p) =>
            hay(p.organization, p.name, p.email, p.location, p.status).includes(needle),
          ),
    [partners, needle],
  );
  const shownField = useMemo(
    () =>
      !needle
        ? fieldCustomers
        : fieldCustomers.filter((c) =>
            hay(
              c.businessName,
              c.name,
              c.customerType,
              c.phone,
              c.location,
              c.region,
              c.rep?.name,
            ).includes(needle),
          ),
    [fieldCustomers, needle],
  );

  const totalShown = shownPartners.length + shownField.length;

  return (
    <>
      {/* ── Search the whole customer book ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search every ORA customer — business name, contact, phone, location or sales rep…"
            className="pl-9"
          />
        </div>
        {needle && (
          <p className="px-1 text-sm text-muted-foreground">
            {totalShown === 0 ? (
              <>No customers match &ldquo;{q.trim()}&rdquo;.</>
            ) : (
              <>
                <span className="font-semibold text-foreground">{totalShown}</span>{" "}
                {totalShown === 1 ? "customer" : "customers"} match &ldquo;{q.trim()}&rdquo;
                {" · "}
                {shownPartners.length} partner{shownPartners.length === 1 ? "" : "s"}
                {" · "}
                {shownField.length} field
              </>
            )}
          </p>
        )}
      </div>

      {/* ── Partners ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Users className="size-5 text-primary" />
          Partners
          <span className="text-sm font-normal text-muted-foreground">
            agents, distributors, NGOs &amp; schools · {shownPartners.length}
            {needle && shownPartners.length !== partners.length ? ` of ${partners.length}` : ""}
          </span>
        </h2>
        <Card className="glass-card">
          <CardContent className="p-0">
            {shownPartners.length === 0 ? (
              <EmptyState
                className="m-6"
                icon={Users}
                title={needle ? "No partners match your search" : "No partners yet"}
              />
            ) : (
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Credit limit</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownPartners.map((p) => {
                    const outstanding = p.creditAccounts
                      .filter((c) => c.status !== "SETTLED")
                      .reduce((s, c) => s + (c.principal - c.amountPaid), 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell data-cardtitle>
                          <Link href={p.href} className="font-medium hover:text-primary">
                            {p.organization ?? p.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{p.name} · {p.email}</div>
                        </TableCell>
                        <TableCell data-label="Location" className="text-sm text-muted-foreground">{p.location ?? "—"}</TableCell>
                        <TableCell data-label="Credit limit" className="text-right">{p.creditLimit != null ? formatCurrency(p.creditLimit) : "—"}</TableCell>
                        <TableCell data-label="Outstanding" className="text-right font-medium">{outstanding > 0 ? formatCurrency(outstanding) : "—"}</TableCell>
                        <TableCell data-label="Status"><StatusBadge status={p.status} /></TableCell>
                        <TableCell data-label="" className="text-right">
                          <Link href={p.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            Open <ChevronRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Field customers — acquired & managed by sales reps ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <BadgeCheck className="size-5 text-success" />
          Field customers
          <span className="text-sm font-normal text-muted-foreground">
            acquired by the sales team · {shownField.length}
            {needle && shownField.length !== fieldCustomers.length ? ` of ${fieldCustomers.length}` : ""}
          </span>
        </h2>
        <Card className="glass-card">
          <CardContent className="p-0">
            {shownField.length === 0 ? (
              <EmptyState
                className="m-6"
                icon={BadgeCheck}
                title={needle ? "No field customers match your search" : "No field customers yet"}
                description={
                  needle
                    ? undefined
                    : "Customers created by sales reps appear here automatically — with their owner."
                }
              />
            ) : (
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sales rep</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Lifetime sales</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownField.map((c) => {
                    // Verified figures come from APPROVED sales only. Lifetime
                    // sales (revenue) excludes migrated opening balances; owed
                    // (outstanding) keeps them — they're real debt.
                    const approved = c.sales.filter((x) => x.financeStatus === "APPROVED");
                    const pending = c.sales.filter((x) => x.financeStatus === "PENDING");
                    const revenue = approved
                      .filter((x) => !x.isOpeningBalance)
                      .reduce((s, x) => s + x.total, 0);
                    const owed = approved
                      .filter((x) => x.type === "CREDIT")
                      .reduce((s, x) => s + Math.max(0, x.total - x.amountPaid), 0);
                    const pendingAmount = pending.reduce((s, x) => s + x.total, 0);
                    return (
                      <TableRow key={c.id}>
                        <TableCell data-cardtitle>
                          <Link href={c.href} className="font-medium hover:text-primary">
                            {c.businessName ?? c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[c.customerType, c.phone].filter(Boolean).join(" · ") || "—"}
                            {c.creditSuspended && (
                              <Badge variant="destructive" className="ml-2 text-[10px]">credit off</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-label="Sales rep">
                          {c.rep == null ? (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          ) : repHrefBase ? (
                            <Link href={`${repHrefBase}/${c.rep.id}`} className="text-sm font-medium text-primary hover:underline">
                              {c.rep.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">{c.rep.name}</span>
                          )}
                        </TableCell>
                        <TableCell data-label="Location" className="text-sm text-muted-foreground">
                          {[c.location, c.region].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell data-label="Lifetime sales" className="text-right">
                          {revenue > 0 ? formatCurrency(revenue) : "—"}
                          {pending.length > 0 && (
                            <span className="mt-0.5 block text-[11px] font-medium text-warning">
                              {formatCurrency(pendingAmount)} awaiting approval
                            </span>
                          )}
                        </TableCell>
                        <TableCell data-label="Outstanding" className="text-right font-medium">
                          {owed > 0 ? <span className="text-warning">{formatCurrency(owed)}</span> : "—"}
                        </TableCell>
                        <TableCell data-label="Registered" className="text-sm text-muted-foreground">
                          {formatDate(c.createdAt)}
                        </TableCell>
                        <TableCell data-label="" className="text-right">
                          <Link href={c.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            Open <ChevronRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
