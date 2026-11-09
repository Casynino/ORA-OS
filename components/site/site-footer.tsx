import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteLogo } from "@/components/site/site-logo";
import { SocialLinks } from "@/components/public/social-links";
import { Atmosphere } from "@/components/site/motion";
import { ORA_CONTACT } from "@/lib/constants";

const COLS = [
  { title: "Explore", links: [["Home", "/"], ["Products", "/products"], ["Impact", "/impact"], ["Education", "/education"], ["News", "/news"]] },
  { title: "Get involved", links: [["Find ORA", "/find-ora"], ["Become an agent", "/request-access"], ["Period tracker", "/tracker"], ["Contact", "/contact"], ["Sign in", "/login"]] },
] as const;

/** The public site's foot: a ticker, the columns, and a giant outlined ORA that the page ends on (like the Vegas site). */
export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/[0.07]">
      <Atmosphere variant="b" grid={false} className="opacity-60" />

      {/* phone: brand across the top, the two link lists side by side, contacts in one row — no long single column */}
      <div className="relative mx-auto grid max-w-[1440px] grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:gap-12 md:py-20">
        <div className="col-span-2 md:col-span-1">
          <SiteLogo />
          <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-white/60 md:mt-6 md:text-[15px]">
            Dignity in every cycle. Championing menstrual health, education and period dignity for girls and women across Tanzania.
          </p>
          <SocialLinks className="mt-5 md:mt-6" itemClassName="size-10 bg-white/[0.06] text-white/75 hover:bg-[rgb(var(--s-pink))] hover:text-white" iconClassName="size-4" />
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="s-label">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-[14px] md:mt-5 md:space-y-3 md:text-[15px]">
              {c.links.map(([l, h]) => (
                <li key={l}>
                  <Link href={h} className="group inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white">
                    {l}
                    <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" strokeWidth={1.5} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="col-span-2 md:col-span-1">
          <p className="s-label">Get in touch</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-[14px] md:mt-5 md:grid-cols-1 md:text-[15px]">
            <li>
              <span className="block text-[12px] text-white/45 md:text-[13px]">Customer care</span>
              <a href={ORA_CONTACT.phoneHref} className="whitespace-nowrap text-white/90 transition-colors hover:text-[rgb(var(--s-pink))]">{ORA_CONTACT.phoneDisplay}</a>
            </li>
            <li>
              <span className="block text-[12px] text-white/45 md:text-[13px]">Email</span>
              <a href={ORA_CONTACT.emailHref} className="text-white/90 transition-colors hover:text-[rgb(var(--s-pink))]">{ORA_CONTACT.email}</a>
            </li>
            <li className="col-span-2 md:col-span-1">
              <span className="block text-[12px] text-white/45 md:text-[13px]">Based in</span>
              <span className="text-white/90">Tanzania</span>
            </li>
          </ul>
        </div>
      </div>

      {/* the page ends on ORA, very big and faint (like the Reckless closing word) */}
      <div aria-hidden className="relative -mb-[0.16em] select-none text-center font-site-display text-[30vw] font-bold leading-[0.8] tracking-[-0.05em] text-[rgb(26_26_29)]">
        ORA
      </div>
      <div className="relative border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-5 py-5 pb-[max(1.25rem,var(--sab))] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
          <p className="s-label normal-case tracking-[0.08em]">© {new Date().getFullYear()} ORA-Pads · All rights reserved</p>
          {/* who made the system, worded and linked like the sign-in page: plain words, no pill or badge (owner, 2026-11-09) */}
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-white/55">
            <span>Pad Distribution Chain</span>
            <Link
              href="/nino"
              aria-label="Pad Distribution Chain by Nino: see his work"
              className="group inline-flex min-h-10 items-center gap-1 rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              by <span className="font-semibold text-white/80 transition-colors group-hover:text-[rgb(var(--s-pink))]">Nino</span>
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
