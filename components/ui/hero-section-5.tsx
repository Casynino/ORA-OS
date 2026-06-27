"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Stethoscope,
  Store,
  Users,
  Truck,
} from "lucide-react";
import { useScroll, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const partners = [
  { icon: GraduationCap, name: "School Programs" },
  { icon: HeartHandshake, name: "NGOs" },
  { icon: Stethoscope, name: "Clinics" },
  { icon: Store, name: "Retail Chains" },
  { icon: Users, name: "Community Groups" },
  { icon: Truck, name: "Distributors" },
];

export function HeroSection() {
  return (
    <>
      <HeroHeader />
      <main className="overflow-x-hidden">
        <section>
          <div className="relative">
            <div className="absolute inset-1 overflow-hidden rounded-3xl lg:rounded-[3rem]">
              <Image
                src="/ora/gallery/g4.jpg"
                alt="ORA community outreach in Tanzania"
                fill
                priority
                sizes="100vw"
                className="animate-ken-burns object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#160a26] via-[#160a26]/65 to-[#160a26]/25" />
            </div>
            <div className="relative py-24 md:pb-32 lg:pb-36 lg:pt-72">
              <div className="mx-auto flex max-w-7xl flex-col px-6 lg:block lg:px-12">
                <div className="mx-auto max-w-lg text-center text-white lg:ml-0 lg:max-w-full lg:text-left">
                  <h1 className="mt-8 max-w-2xl text-balance font-display text-5xl font-bold leading-[1.03] md:text-6xl lg:mt-16 xl:text-7xl">
                    Empowering every cycle.
                  </h1>
                  <p className="mt-8 max-w-2xl text-balance text-lg text-white/80">
                    Quality menstrual care and education for every girl and woman
                    in Tanzania — building healthier, more confident communities.
                  </p>
                  <div className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start">
                    <Button
                      asChild
                      variant="accent"
                      size="lg"
                      className="h-12 rounded-full pl-5 pr-3 text-base shadow-glow"
                    >
                      <Link href="/donate">
                        <span className="text-nowrap">Donate now</span>
                        <ChevronRight className="ml-1" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-white/30 bg-white/10 px-5 text-base text-white hover:bg-white/20"
                    >
                      <Link href="/request-access">
                        <span className="text-nowrap">Become a partner</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-background pb-2 pt-10">
          <div className="group relative m-auto max-w-7xl px-6">
            <div className="flex flex-col items-center md:flex-row">
              <div className="md:max-w-44 md:border-r md:pr-6">
                <p className="text-end text-sm text-muted-foreground">
                  Trusted across Tanzania
                </p>
              </div>
              <div className="relative py-6 md:w-[calc(100%-11rem)]">
                <InfiniteSlider durationOnHover={90} duration={32} gap={80}>
                  {partners.map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <p.icon className="size-5" />
                      <span className="whitespace-nowrap text-sm font-medium">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </InfiniteSlider>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background" />
                <ProgressiveBlur
                  className="pointer-events-none absolute left-0 top-0 h-full w-20"
                  direction="left"
                  blurIntensity={1}
                />
                <ProgressiveBlur
                  className="pointer-events-none absolute right-0 top-0 h-full w-20"
                  direction="right"
                  blurIntensity={1}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const menuItems = [
  { name: "Impact", href: "/impact" },
  { name: "Education", href: "/education" },
  { name: "Donate", href: "/donate" },
  { name: "Partners", href: "/request-access" },
];

const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { scrollYProgress } = useScroll();

  React.useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      setScrolled(latest > 0.05);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <header>
      <nav
        data-state={menuState && "active"}
        className="group fixed z-20 w-full pt-2"
      >
        <div
          className={cn(
            "mx-auto max-w-7xl rounded-3xl px-6 transition-all duration-300 lg:px-12",
            scrolled && "bg-background/50 backdrop-blur-2xl",
          )}
        >
          <motion.div
            key={1}
            className={cn(
              "relative flex flex-wrap items-center justify-between gap-6 py-3 duration-200 lg:gap-0 lg:py-6",
              scrolled && "lg:py-4",
            )}
          >
            <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center space-x-2">
                <Logo />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState == true ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="group-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>

              <div className="hidden lg:block">
                <ul className="flex gap-8 text-sm">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        className="block text-muted-foreground duration-150 hover:text-accent-foreground"
                      >
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border bg-background p-6 shadow-2xl shadow-zinc-300/20 group-data-[state=active]:block md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none lg:group-data-[state=active]:flex">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        className="block text-muted-foreground duration-150 hover:text-accent-foreground"
                      >
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">
                    <span>Sign in</span>
                  </Link>
                </Button>
                <Button asChild size="sm" variant="accent">
                  <Link href="/donate">
                    <span>Donate</span>
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </nav>
    </header>
  );
};
