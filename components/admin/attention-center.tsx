"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { AttentionPanel, type AttentionPanelItem, type AttentionTab } from "@/components/ui/attention-panel";

// The CEO's "Needs your attention": credit alerts, low stock and the finance sign-off pipeline, shown
// in the one small shared panel (components/ui/attention-panel.tsx) — three rows in view, the rest a
// scroll away, so a busy day can't push the rest of the dashboard out of view.

export type AttnCategory = "overdue" | "dueSoon" | "signoff" | "funds" | "stock";
export type AttnTone = "danger" | "warning" | "info";

export type AttnItem = {
  key: string;
  category: AttnCategory;
  iconKey: "overdue" | "dueSoon" | "stock" | "cash" | "credit" | "collect" | "fund";
  tone: AttnTone;
  label: string;
  hint: string;
  amount?: number | null;
  href: string;
};

// Pill order is also the priority order: overdue money → sign-offs → fund requests → due soon → low stock.
const TABS: AttentionTab[] = [
  { key: "overdue", label: "Overdue" },
  { key: "signoff", label: "Sign-offs" },
  { key: "funds", label: "Fund requests" },
  { key: "dueSoon", label: "Due soon" },
  { key: "stock", label: "Low stock" },
];
const PRIORITY = Object.fromEntries(TABS.map((t, i) => [t.key, i])) as Record<AttnCategory, number>;

export function AttentionCenter({ items }: { items: AttnItem[] }) {
  const rows = useMemo<AttentionPanelItem[]>(
    () =>
      [...items]
        .sort((a, b) => PRIORITY[a.category] - PRIORITY[b.category])
        .map((i) => ({
          id: i.key,
          group: i.category,
          tone: i.tone,
          icon: i.iconKey,
          title: i.label,
          detail: i.hint,
          main: i.amount != null ? formatCurrency(i.amount) : undefined,
          href: i.href,
        })),
    [items],
  );
  const hasSignoff = items.some((i) => i.category === "signoff");

  return (
    <AttentionPanel
      items={rows}
      tabs={TABS}
      empty="All clear — nothing needs your attention right now."
      action={hasSignoff ? { label: "Review all", href: "/admin/sales-approvals" } : undefined}
    />
  );
}
