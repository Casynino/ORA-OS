"use client";

import {
  GraduationCap,
  HeartHandshake,
  Stethoscope,
  Store,
  Users,
  Truck,
  Building2,
  School,
} from "lucide-react";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";

const partners = [
  { icon: GraduationCap, name: "School Programs" },
  { icon: HeartHandshake, name: "NGOs" },
  { icon: Stethoscope, name: "Clinics" },
  { icon: Store, name: "Retail Chains" },
  { icon: Users, name: "Community Groups" },
  { icon: Truck, name: "Distributors" },
  { icon: Building2, name: "Local Government" },
  { icon: School, name: "Universities" },
];

export function PartnersMarquee() {
  return (
    <section className="border-y border-border/60 bg-white/40 py-6 backdrop-blur">
      <div className="container">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <p className="shrink-0 text-sm font-medium text-muted-foreground md:border-r md:border-border md:pr-6 md:text-right">
            Trusted across Tanzania
          </p>
          <div className="relative w-full md:w-[calc(100%-13rem)]">
            <InfiniteSlider duration={32} durationOnHover={90} gap={48}>
              {partners.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <p.icon className="size-4" />
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium">
                    {p.name}
                  </span>
                </div>
              ))}
            </InfiniteSlider>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
            <ProgressiveBlur
              className="pointer-events-none absolute left-0 top-0 h-full w-16"
              direction="left"
              blurIntensity={1}
            />
            <ProgressiveBlur
              className="pointer-events-none absolute right-0 top-0 h-full w-16"
              direction="right"
              blurIntensity={1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
