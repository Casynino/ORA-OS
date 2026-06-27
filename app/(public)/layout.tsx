import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { AuroraBackground } from "@/components/public/aurora-background";
import { getCurrentUser } from "@/lib/rbac";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <AuroraBackground />
      <SiteHeader
        user={user ? { name: user.name, role: user.role } : null}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
