import { notFound } from "next/navigation";
import {
  User,
  Building2,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  Lock,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { RequestCreditIncrease } from "@/components/dashboard/request-credit-increase";
import { ContactOra } from "@/components/dashboard/contact-ora";
import { SocialLinks } from "@/components/public/social-links";
import { buttonVariants } from "@/components/ui/button";
import { ORA_CONTACT } from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function PartnerProfilePage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [accounts, messages] = await Promise.all([
    prisma.creditAccount.findMany({
      where: { agentId: me.id, status: { not: "SETTLED" } },
      select: { principal: true, amountPaid: true },
    }),
    prisma.contactMessage.findMany({
      where: { senderId: me.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const limit = me.creditLimit ?? 0;
  const outstanding = accounts.reduce(
    (s, a) => s + Math.max(0, a.principal - a.amountPaid),
    0,
  );
  const available = Math.max(0, limit - outstanding);
  const usedPct = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="The details you registered with ORA. To update anything, contact the ORA team."
      >
        <ContactOra />
        <RequestCreditIncrease currentLimit={limit} />
      </PageHeader>

      {/* Read-only banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        Your profile is read-only. The ORA team keeps these records — reach out to
        them to change any detail or raise your credit limit.
      </div>

      {/* Direct support */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Need a hand?</p>
            <p className="text-sm text-muted-foreground">
              Reach the ORA team directly for orders, credit or returns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={ORA_CONTACT.phoneHref}
              aria-label="Call ORA customer care"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Phone className="size-4" />
              {ORA_CONTACT.phoneDisplay}
            </a>
            <a
              href={ORA_CONTACT.emailHref}
              aria-label="Email ORA"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Mail className="size-4" />
              Email
            </a>
            <SocialLinks itemClassName="bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Credit summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credit limit" value={formatCurrency(limit)} icon={CreditCard} accent="primary" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={CreditCard} accent="warning" />
        <StatCard label="Available credit" value={formatCurrency(available)} icon={CreditCard} accent="success" />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credit used</span>
            <span className="font-medium">
              {formatCurrency(outstanding)} of {formatCurrency(limit)}
            </span>
          </div>
          <Progress value={usedPct} className="mt-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {me.paymentTerms ? `Payment terms: ${me.paymentTerms}. ` : ""}
            Need more room? Use “Request credit increase” above.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4" /> Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field icon={User} label="Full name" value={me.name} />
            <Field icon={Mail} label="Email" value={me.email} />
            <Field icon={Phone} label="Phone" value={me.phone ?? "—"} />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" /> Status
              </span>
              <StatusBadge status={me.status} />
            </div>
            <Field icon={MapPin} label="Member since" value={formatDate(me.createdAt)} />
          </CardContent>
        </Card>

        {/* Business */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" /> Business details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field icon={Building2} label="Organization" value={me.organization ?? "—"} />
            <Field icon={Building2} label="Business type" value={me.businessType ?? "—"} />
            <Field icon={MapPin} label="Region" value={me.region ?? "—"} />
            <Field icon={MapPin} label="Location" value={me.location ?? "—"} />
            <Field icon={Building2} label="Expected volume" value={me.expectedVolume ?? "—"} />
            <Field icon={CreditCard} label="Preferred payment" value={me.preferredPayment ?? "—"} />
            <Field icon={Building2} label="Business licence" value={me.businessLicense ?? "—"} />
            <Field icon={Building2} label="Tax ID (TIN)" value={me.taxId ?? "—"} />
          </CardContent>
        </Card>
      </div>

      {/* Messages with ORA */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-4" /> Messages with ORA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{m.subject ?? "Message"}</p>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </p>
                {m.reply && (
                  <div className="mt-2 rounded-md bg-primary/5 p-2.5">
                    <p className="text-xs font-medium text-primary">ORA team replied</p>
                    <p className="text-sm">{m.reply}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
