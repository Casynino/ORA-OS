import { redirect } from "next/navigation";

// System health now lives on the Developer Home (older links and bookmarks land there).
export default function MonitorMovedPage() {
  redirect("/developer");
}
