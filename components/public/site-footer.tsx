import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/public/social-links";
import { ORA_CONTACT } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Dignity in every cycle. Championing menstrual health, education and
            period dignity for girls and women across Tanzania.
          </p>
          <SocialLinks
            itemClassName="bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            iconClassName="size-4"
          />
        </div>

        <div>
          <h4 className="text-[15px] font-medium">Explore</h4>
          <ul className="mt-4 space-y-3 text-[15px] text-muted-foreground">
            <li>
              <Link href="/impact" className="transition-colors hover:text-foreground">Our impact</Link>
            </li>
            <li>
              <Link href="/education" className="transition-colors hover:text-foreground">
                Education hub
              </Link>
            </li>
            <li>
              <Link href="/impact" className="transition-colors hover:text-foreground">
                Impact stories
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/request-access" className="transition-colors hover:text-foreground">
                Request access
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[15px] font-medium">For partners</h4>
          <ul className="mt-4 space-y-3 text-[15px] text-muted-foreground">
            <li>
              <Link href="/request-access" className="transition-colors hover:text-foreground">
                Become an agent
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-foreground">
                Partner sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[15px] font-medium">Get in touch</h4>
          <ul className="mt-4 space-y-4 text-[15px] text-muted-foreground">
            <li>
              <a
                href={ORA_CONTACT.phoneHref}
                aria-label="Call ORA customer care"
                className="flex items-start gap-2.5 hover:text-foreground"
              >
                <Phone className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                <span>
                  <span className="block text-[13px]">Customer care</span>
                  <span className="font-medium text-foreground">
                    {ORA_CONTACT.phoneDisplay}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={ORA_CONTACT.emailHref}
                aria-label="Email ORA"
                className="flex items-start gap-2.5 hover:text-foreground"
              >
                <Mail className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                <span>
                  <span className="block text-[13px]">Email</span>
                  <span className="font-medium text-foreground">
                    {ORA_CONTACT.email}
                  </span>
                </span>
              </a>
            </li>
            <li className="pt-1">
              <span className="block text-[13px]">Follow ORA</span>
              <SocialLinks
                className="mt-2"
                itemClassName="bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                iconClassName="size-4"
              />
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col justify-between gap-2 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[13px] text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ORA-Pads. All rights reserved.</p>
          <p>Empowering every cycle · made in Tanzania</p>
        </div>
      </div>
    </footer>
  );
}
