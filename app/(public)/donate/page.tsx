import { permanentRedirect } from "next/navigation";

// ORA no longer accepts monetary donations — the movement lives at /impact.
export default function DonateRedirect() {
  permanentRedirect("/impact");
}
