"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  GraduationCap,
  HeartHandshake,
  Stethoscope,
  Store,
  Users,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

const menuItems = [
  { name: "Impact", href: "/impact" },
  { name: "Education", href: "/education" },
  { name: "Donate", href: "/donate" },
  { name: "Partners", href: "/request-access" },
];

const partners = [
  { name: "School Programs", icon: GraduationCap },
  { name: "NGOs", icon: HeartHandshake },
  { name: "Clinics", icon: Stethoscope },
  { name: "Retail Chains", icon: Store },
  { name: "Community Groups", icon: Users },
  { name: "Distributors", icon: Truck },
];

export const HeroSection = ({ showNav = true }: { showNav?: boolean } = {}) => {
  const [menuState, setMenuState] = React.useState(false);
  return (
    <div>
      {showNav && (
      <header>
        <nav
          data-state={menuState && "active"}
          className="group fixed z-20 w-full border-b border-dashed bg-white/80 backdrop-blur md:relative dark:bg-zinc-950/50 lg:dark:bg-transparent">
          <div className="m-auto max-w-5xl px-6">
            <div className="flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
              <div className="flex w-full justify-between lg:w-auto">
                <Link href="/" aria-label="home" className="flex items-center space-x-2">
                  <Logo />
                </Link>

                <button
                  onClick={() => setMenuState(!menuState)}
                  aria-label={menuState == true ? "Close Menu" : "Open Menu"}
                  className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                  <Menu className="group-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                  <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                </button>
              </div>

              <div className="bg-background group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                <div className="lg:pr-4">
                  <ul className="space-y-6 text-base lg:flex lg:gap-8 lg:space-y-0 lg:text-sm">
                    {menuItems.map((item, index) => (
                      <li key={index}>
                        <Link
                          href={item.href}
                          className="text-muted-foreground hover:text-accent-foreground block duration-150">
                          <span>{item.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit lg:border-l lg:pl-6">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">
                      <span>Sign in</span>
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/donate">
                      <span>Donate</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>
      )}

      <main>
        <div
          aria-hidden
          className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block">
          <div className="w-[35rem] h-[80rem] -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(174,72%,40%,.10)_0,hsla(174,60%,40%,.04)_50%,hsla(174,45%,45%,0)_80%)]" />
          <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(340,78%,52%,.08)_0,hsla(340,45%,52%,.03)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="h-[80rem] -translate-y-87.5 absolute left-0 top-0 w-56 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(174,72%,40%,.06)_0,hsla(174,45%,45%,.03)_80%,transparent_100%)]" />
        </div>

        <section className="overflow-hidden bg-white dark:bg-transparent">
          <div className="relative mx-auto max-w-5xl px-6 py-28 lg:py-24">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h1 className="text-balance text-4xl font-semibold md:text-5xl lg:text-6xl">
                Empowering every cycle.
              </h1>
              <p className="mx-auto my-8 max-w-2xl text-xl text-muted-foreground">
                Building healthier communities through access, education and
                impact — one girl, one school, one community at a time. The
                business runs quietly behind the scenes; the mission stays front
                and centre.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/donate">
                    <span className="btn-label">Donate Now</span>
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/request-access">
                    <span className="btn-label">Become a Partner</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-auto -mt-16 max-w-7xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
            <div className="[perspective:1200px] [mask-image:linear-gradient(to_right,black_50%,transparent_100%)] -mr-16 pl-16 lg:-mr-56 lg:pl-56">
              <div className="[transform:rotateX(20deg);]">
                <div className="lg:h-[44rem] relative skew-x-[.36rad]">
                  <Image
                    className="rounded-[--radius] z-[2] relative border object-cover"
                    src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2880&auto=format&fit=crop"
                    alt="Ora community programs reaching girls and schools"
                    width={2880}
                    height={2074}
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background relative z-10 py-16">
          <div className="m-auto max-w-5xl px-6">
            <h2 className="text-center text-lg font-medium">
              Trusted by schools, NGOs, clinics and partners across the region.
            </h2>
            <div className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
              {partners.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 text-muted-foreground">
                  <p.icon className="size-5" />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
