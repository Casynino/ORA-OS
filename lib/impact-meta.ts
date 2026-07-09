import {
  GraduationCap,
  Users,
  BookOpen,
  Megaphone,
  Package,
  Sparkles,
} from "lucide-react";
import type { ImpactFeedItem } from "@/lib/services/impact";
import { formatNumber } from "@/lib/utils";

// Shared (server + client) activity metadata and phrasing.

export const ACTIVITY_TYPES: {
  key: string;
  label: string;
  icon: typeof Users;
}[] = [
  { key: "SCHOOL_VISIT", label: "School visit", icon: GraduationCap },
  { key: "COMMUNITY_OUTREACH", label: "Community outreach", icon: Users },
  { key: "EDUCATION_SESSION", label: "Education session", icon: BookOpen },
  { key: "AWARENESS_CAMPAIGN", label: "Awareness campaign", icon: Megaphone },
  { key: "PAD_DISTRIBUTION", label: "Pad distribution", icon: Package },
  { key: "OTHER", label: "Activity", icon: Sparkles },
];

export const activityMeta = (key: string) =>
  ACTIVITY_TYPES.find((t) => t.key === key) ?? ACTIVITY_TYPES[5];

/** One warm line per activity — the movement, not money. */
export function impactLine(a: ImpactFeedItem): string {
  const pads = a.padsDistributed > 0 ? `${formatNumber(a.padsDistributed)} pads` : "";
  const people = a.peopleReached > 0 ? `${formatNumber(a.peopleReached)} girls` : "";
  switch (a.type) {
    case "SCHOOL_VISIT":
      return `ORA visited ${a.location}${pads ? ` — ${pads} distributed` : ""}`;
    case "EDUCATION_SESSION":
      return `${people || "Girls"} learned with ORA at ${a.location}`;
    case "AWARENESS_CAMPAIGN":
      return `ORA raised awareness at ${a.location}${people ? ` — ${people} reached` : ""}`;
    case "PAD_DISTRIBUTION":
      return `${pads || "Pads"} delivered at ${a.location}`;
    default:
      return `ORA supported ${a.location}${people ? ` — ${people} reached` : ""}`;
  }
}
