import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Dignity in every cycle. Championing menstrual health, education and
            period dignity for girls and women across Tanzania.
          </p>
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
          <h4 className="text-sm font-semibold">About</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            A movement for menstrual dignity — putting pads, education and
            confidence into the hands of girls across Tanzania.
          </p>
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
