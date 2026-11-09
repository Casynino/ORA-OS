/*
  Shared by the server wrapper and the client sidebar, so it lives outside any
  "use client" file: a server component importing a constant from a client module
  receives a client reference, not the value.
*/

/** Read by the dashboard shell so a folded sidebar is folded on the very first paint. */
export const SIDEBAR_COOKIE = "ora.sidebar";

/** The room the page leaves for the floating panel, open and folded. */
export const SIDEBAR_ROOM = { open: "15.5rem", rail: "5.9rem" } as const;
