import type { Metadata } from "next";
import { HeroSection } from "@/components/ui/hero-section-5";

export const metadata: Metadata = {
  title: "Landing preview · full-bleed",
  description: "Full-bleed cinematic hero variant for the ORA public site.",
};

export default function LandingV3Page() {
  return <HeroSection />;
}
