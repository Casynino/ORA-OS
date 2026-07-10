import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conditional logic. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with thousands separators (e.g. 12400 -> "12,400"). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format a money amount in Tanzanian shillings ("TSh"). Product pricing is
 * admin-controlled and never shown publicly — this is used inside authenticated
 * views and for public donation/impact figures.
 */
export function formatCurrency(
  value: number | null | undefined,
  symbol = "TSh",
): string {
  if (value == null) return "—";
  return `${symbol} ${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

/**
 * Compact money for headline figures — e.g. "TSh 200.4M", "TSh 1.2B".
 * Used where full precision would overflow a KPI card.
 */
export function formatCompactCurrency(
  value: number | null | undefined,
  symbol = "TSh",
): string {
  if (value == null) return "—";
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${symbol} ${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${symbol} ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol} ${(n / 1_000).toFixed(1)}K`;
  return `${symbol} ${new Intl.NumberFormat("en-US").format(n)}`;
}

/** Short, human date — e.g. "25 Jun 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Date + time — e.g. "25 Jun 2026, 14:30". */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "3 days ago" style relative time. */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/** Title-case an ENUM_LIKE_VALUE -> "Enum Like Value". */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Deterministic initials for avatars. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/** Generate a short, human-friendly reference code (e.g. REQ-7F3K2A). */
export function refCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}
