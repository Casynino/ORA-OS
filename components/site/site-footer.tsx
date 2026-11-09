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

      <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:py-20">
        <div>
          <SiteLogo />
          <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-white/60">
            Dignity in every cycle. Championing menstrual health, education and period dignity for girls and women across Tanzania.
          </p>
          <SocialLinks className="mt-6" itemClassName="size-10 bg-white/[0.06] text-white/75 hover:bg-[rgb(var(--s-pink))] hover:text-white" iconClassName="size-4" />
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="s-label">{c.title}</p>
            <ul className="mt-5 space-y-3 text-[15px]">
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
        <div>
          <p className="s-label">Get in touch</p>
          <ul className="mt-5 space-y-4 text-[15px]">
            <li>
              <span className="block text-[13px] text-white/45">Customer care</span>
              <a href={ORA_CONTACT.phoneHref} className="text-white/90 transition-colors hover:text-[rgb(var(--s-pink))]">{ORA_CONTACT.phoneDisplay}</a>
            </li>
            <li>
              <span className="block text-[13px] text-white/45">Email</span>
              <a href={ORA_CONTACT.emailHref} className="text-white/90 transition-colors hover:text-[rgb(var(--s-pink))]">{ORA_CONTACT.email}</a>
            </li>
            <li>
              <span className="block text-[13px] text-white/45">Based in</span>
              <span className="text-white/90">Tanzania</span>
            </li>
          </ul>
        </div>
      </div>

      {/* the page ends on ORA, very big and faint (like the Reckless closing word) */}
      <div aria-hidden className="relative -mb-[0.16em] select-none text-center font-site-display text-[34vw] font-bold leading-[0.8] tracking-[-0.05em] text-[rgb(26_26_29)] md:text-[30vw]">
        ORA
      </div>
      <div className="relative border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 pb-[max(1.5rem,var(--sab))] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="s-label normal-case tracking-[0.08em]">© {new Date().getFullYear()} ORA-Pads · All rights reserved</p>
          <p className="s-label">Empowering every cycle · Made in Tanzania</p>
        </div>
      </div>
    </footer>
  );
}
