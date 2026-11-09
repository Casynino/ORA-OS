import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getCurrentUser } from "@/lib/rbac";
import { siteFontVars } from "@/lib/site-fonts";
import { cn } from "@/lib/utils";
import { Galaxy } from "@/components/site/galaxy";
import { SiteCursor } from "@/components/site/cursor";

/** Every public page shares the home page's world: ORA's night ground, the cinematic header and the big footer. */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className={cn("ora-site s-grain flex min-h-screen flex-col", siteFontVars)}>
      <Galaxy />
      <SiteCursor />
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} />
      <main className="relative z-[1] flex-1">{children}</main>
      <div className="relative z-[1]">
        <SiteFooter />
      </div>
    </div>
  );
}
