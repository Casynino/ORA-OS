import { cookies } from "next/headers";
import { DashboardShellView, type NavGroup, type NavItem } from "@/components/dashboard/dashboard-shell-view";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

export type { NavGroup, NavItem };

type ShellProps = Omit<React.ComponentProps<typeof DashboardShellView>, "sidebarCollapsed">;

/**
 * The shell every department's layout uses. A thin server wrapper: it reads the "folded sidebar"
 * cookie so the sidebar is folded (or open) on the very first paint, then hands everything to the
 * client shell. Layouts keep importing `DashboardShell` and its types from here, unchanged.
 */
export async function DashboardShell(props: ShellProps) {
  const folded = (await cookies()).get(SIDEBAR_COOKIE)?.value === "rail";
  return <DashboardShellView {...props} sidebarCollapsed={folded} />;
}
