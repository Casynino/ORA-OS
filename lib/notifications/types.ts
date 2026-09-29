// Client-safe notification types (no server imports) — shared by the API route
// and the client bell.

export type NotifDTO = {
  id: string;
  category: "ACTION" | "INFO";
  type: string;
  title: string;
  body: string;
  actorName: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  read: boolean;
  resolved: boolean;
  createdAt: string; // ISO
};

export type NotifPulse = {
  items: NotifDTO[]; // recent feed (history), newest first
  waitingIds: string[]; // unresolved ACTION ids — drive the repeating sound + waiting badge
  unread: number; // unread count for the badge
  v: string; // cheap change token
};
