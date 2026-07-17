"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { path: "", label: "Overview" },
  { path: "/expenses", label: "Expenses" },
  { path: "/capital", label: "Capital" },
  { path: "/accounts", label: "Accounts" },
  { path: "/cash", label: "Cash & deposits" },
  { path: "/petty-cash", label: "Office fund" },
  { path: "/payroll", label: "Payroll" },
  { path: "/ledger", label: "Ledger" },
];

export function FinanceNav({
  basePath = "/admin/finance",
}: {
  basePath?: string;
}) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1.5">
      {LINKS.map((raw) => {
        const l = { href: basePath + raw.path, label: raw.label };
        const active =
          l.href === basePath
            ? pathname === l.href
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}

export function PeriodTabs({
  period,
  basePath,
}: {
  period: string;
  basePath: string;
}) {
  const tabs = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "all", label: "All time" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${basePath}?period=${t.key}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            period === t.key
              ? "bg-primary/12 text-primary ring-1 ring-primary/40"
              : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
