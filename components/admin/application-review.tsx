"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Check,
  X,
  Tag,
  CreditCard,
  Briefcase,
  Globe,
  TrendingUp,
  Wallet,
  FileText,
  Hash,
} from "lucide-react";
import {
  approveApplication,
  rejectApplication,
  requestApplicationInfo,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

type ProductDTO = { productId: string; name: string; sku: string; price: number };

export type AppDTO = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  location: string | null;
  status: string;
  businessType: string | null;
  region: string | null;
  district: string | null;
  street: string | null;
  expectedVolume: string | null;
  preferredPayment: string | null;
  businessLicense: string | null;
  taxId: string | null;
  creditLimit: number | null;
  paymentTerms: string | null;
  applicationNote: string | null;
  appliedAt: string;
  products: ProductDTO[];
};

export function ApplicationReview({ app }: { app: AppDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pendingApp = app.status === "PENDING";

  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(app.products.map((p) => [p.productId, String(p.price)])),
  );
  const [creditLimit, setCreditLimit] = useState(
    String(app.creditLimit ?? 0),
  );
  const [terms, setTerms] = useState(app.paymentTerms ?? "");

  function approve() {
    start(async () => {
      const res = await approveApplication({
        userId: app.id,
        creditLimit: Math.max(0, Math.round(Number(creditLimit) || 0)),
        paymentTerms: terms || undefined,
        prices: app.products.map((p) => ({
          productId: p.productId,
          price: Math.max(0, Math.round(Number(prices[p.productId]) || 0)),
        })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push("/admin/applications");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  function reject() {
    const reason = window.prompt("Reason for rejection (optional)") ?? undefined;
    start(async () => {
      const res = await rejectApplication(app.id, reason);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push("/admin/applications");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  function requestInfo() {
    const message = window.prompt(
      "What information do you need from the applicant?",
    );
    if (!message || message.trim().length < 3) return;
    start(async () => {
      const res = await requestApplicationInfo({ userId: app.id, message });
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  const details = [
    { icon: Briefcase, label: "Business type", value: app.businessType },
    { icon: Globe, label: "Region", value: app.region },
    { icon: MapPin, label: "District", value: app.district },
    { icon: TrendingUp, label: "Expected monthly volume", value: app.expectedVolume },
    { icon: Wallet, label: "Preferred payment", value: app.preferredPayment },
    { icon: FileText, label: "Business licence", value: app.businessLicense },
    { icon: Hash, label: "Tax ID / TIN", value: app.taxId },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All applications
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={app.name} className="size-14" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {app.organization ?? app.name}
            </h1>
            {app.businessType && <Badge variant="accent">{app.businessType}</Badge>}
            <StatusBadge status={app.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {app.name} · applied{" "}
            {new Date(app.appliedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* Business details */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Building2 className="size-4 text-muted-foreground" />
                Business details
              </h2>
            </div>
            <div className="space-y-2.5 px-5 py-4 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-all">{app.email}</span>
              </p>
              {app.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-all">{app.phone}</span>
                </p>
              )}
              {app.location && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">{app.location}</span>
                </p>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2">
              {details.map((d) => (
                <div key={d.label} className="min-w-0 bg-card px-4 py-3 sm:px-5">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <d.icon className="size-3.5 shrink-0" />
                    {d.label}
                  </dt>
                  <dd className="mt-0.5 break-words font-medium">{d.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Commercial terms + actions */}
        <section className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Tag className="size-4 text-muted-foreground" />
                Commercial terms
              </h2>
              <p className="text-xs text-muted-foreground">
                Set this partner&apos;s prices and credit before approving.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2.5">
                {app.products.map((p) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        standard {formatCurrency(p.price)}
                      </p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min={0}
                        value={prices[p.productId]}
                        onChange={(e) =>
                          setPrices((prev) => ({
                            ...prev,
                            [p.productId]: e.target.value,
                          }))
                        }
                        disabled={!pendingApp}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs">
                    <CreditCard className="size-3.5" />
                    Credit limit (TSh)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    disabled={!pendingApp}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment terms</Label>
                  <Input
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="e.g. Net 30"
                    disabled={!pendingApp}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {app.applicationNote && (
              <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-sm">
                <Mail className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-foreground">Information requested from applicant</p>
                  <p className="text-muted-foreground">{app.applicationNote}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Reach them on {app.phone ?? app.email} to follow up.
                  </p>
                </div>
              </div>
            )}
            {pendingApp ? (
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
                <Button onClick={approve} disabled={pending} variant="success" className="flex-1">
                  <Check className="size-4" />
                  {pending ? "Approving…" : "Approve & activate"}
                </Button>
                <Button onClick={requestInfo} disabled={pending} variant="outline">
                  <Mail className="size-4" />
                  Request info
                </Button>
                <Button
                  onClick={reject}
                  disabled={pending}
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                This application has already been processed (
                {app.status.toLowerCase()}).
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
