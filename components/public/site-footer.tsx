import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/public/social-links";
import { ORA_CONTACT } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
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
          <h4 className="text-sm font-semibold">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/donate" className="hover:text-foreground">
                Donate
              </Link>
            </li>
            <li>
              <Link href="/education" className="hover:text-foreground">
                Education hub
              </Link>
            </li>
            <li>
              <Link href="/impact" className="hover:text-foreground">
                Impact stories
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/request-access" className="hover:text-foreground">
                Request access
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">For partners</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/request-access" className="hover:text-foreground">
                Become an agent
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Partner sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Get in touch</h4>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li>
              <a
                href={ORA_CONTACT.phoneHref}
                aria-label="Call ORA customer care"
                className="flex items-start gap-2.5 hover:text-foreground"
              >
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-xs uppercase tracking-wide">
                    Customer Care
                  </span>
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
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-xs uppercase tracking-wide">
                    Email
                  </span>
                  <span className="font-medium text-foreground">
                    {ORA_CONTACT.email}
                  </span>
                </span>
              </a>
            </li>
            <li className="pt-1">
              <span className="block text-xs uppercase tracking-wide">
                Follow ORA
              </span>
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
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ORA-Pads. All rights reserved.</p>
          <p>Empowering every cycle · made in Tanzania</p>
        </div>
      </div>
    </footer>
  );
}
