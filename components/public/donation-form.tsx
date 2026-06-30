"use client";

import { useState, useTransition } from "react";
import { Check, Heart, PartyPopper, Smartphone, ShieldCheck, Pencil } from "lucide-react";
import { createDonation } from "@/lib/actions/donations";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatNumber } from "@/lib/utils";

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  type: "PADS" | "MONEY";
  amount: number | null;
  padsQuantity: number | null;
};

// What one pad costs to fund (TSh) — mirrors PER_PAD_TZS on the server.
const PER_PAD_TZS = 500;

type DoneInfo = { code: string; paymentInitiated: boolean; instructions?: string };

function priceOf(p: Pkg) {
  return p.type === "MONEY"
    ? p.amount ?? 0
    : p.amount ?? (p.padsQuantity ?? 0) * PER_PAD_TZS;
}

export function DonationForm({ packages }: { packages: Pkg[] }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<DoneInfo | null>(null);

  const [packageId, setPackageId] = useState<string | "custom">(
    packages[0]?.id ?? "custom",
  );
  const [amount, setAmount] = useState("5000");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");

  const isCustom = packageId === "custom";
  const selectedPkg = packages.find((p) => p.id === packageId);
  const charge = isCustom ? Number(amount) || 0 : selectedPkg ? priceOf(selectedPkg) : 0;

  function submit() {
    if (!donorName.trim())
      return toast({ variant: "error", title: "Please enter your name." });
    if (!donorPhone.trim())
      return toast({ variant: "error", title: "Enter your mobile number to pay." });

    const input = isCustom
      ? {
          type: "MONEY" as const,
          donorName,
          donorEmail: donorEmail || undefined,
          donorPhone,
          message: message || undefined,
          amount: Number(amount),
        }
      : {
          type: "MONEY" as const, // overridden server-side by package
          donorName,
          donorEmail: donorEmail || undefined,
          donorPhone,
          message: message || undefined,
          packageId,
        };

    startTransition(async () => {
      const res = await createDonation(input);
      if (res.ok) {
        setDone({
          code: res.data?.code ?? "",
          paymentInitiated: res.data?.paymentInitiated ?? false,
          instructions: res.data?.instructions,
        });
        toast({ variant: "success", title: res.message });
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center px-2 py-6 text-center sm:py-8">
        <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-glow">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="float-heart absolute text-primary"
              style={{ left: `${44 + (i - 1.5) * 12}%`, animationDelay: `${i * 0.1}s` }}
            >
              <Heart className="size-3.5 fill-primary" />
            </span>
          ))}
          {done.paymentInitiated ? (
            <Smartphone className="size-7" />
          ) : (
            <PartyPopper className="size-7" />
          )}
        </span>
        <h3 className="mt-4 font-display text-xl font-bold tracking-tight">
          {done.paymentInitiated
            ? "Approve it on your phone 📲"
            : `Thank you, ${donorName.split(" ")[0]}!`}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {done.paymentInitiated ? (
            <>
              {done.instructions ??
                "Check your phone for the mobile-money prompt and enter your PIN."}{" "}
              Your gift{done.code ? ` (${done.code})` : ""} confirms the moment it clears
              — watch it appear in the live feed.
            </>
          ) : (
            <>
              Your donation has been recorded{done.code ? ` as ${done.code}` : ""}. Our
              team will confirm and allocate it where it&apos;s needed most.
            </>
          )}
        </p>
        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => {
            setDone(null);
            setMessage("");
          }}
        >
          Make another gift
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Impact tiers */}
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Choose your impact
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {packages.map((p) => {
            const selected = packageId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPackageId(p.id)}
                className={cn(
                  "group relative flex flex-col items-start rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                  selected
                    ? "border-primary bg-primary/[0.07] shadow-glow ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    selected
                      ? "bg-gradient-to-br from-primary to-accent text-white"
                      : "bg-primary/10 text-primary group-hover:bg-primary/20",
                  )}
                >
                  <Heart className="size-3.5" />
                </span>
                <span className="mt-2 font-display text-lg font-bold leading-none">
                  {formatNumber(p.padsQuantity ?? 0)}
                  <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                    packs
                  </span>
                </span>
                <span className="mt-1 text-sm font-bold text-primary">
                  TSh {formatNumber(priceOf(p))}
                </span>
                {selected && (
                  <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <button
          type="button"
          onClick={() => setPackageId("custom")}
          className={cn(
            "mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-left transition-all",
            isCustom
              ? "border-primary bg-primary/[0.07] ring-1 ring-primary/40"
              : "border-border hover:border-primary/40",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Pencil className="size-3.5" />
          </span>
          {isCustom ? (
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">TSh</span>
              <Input
                type="number"
                min={500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="h-9 flex-1"
                placeholder="Enter amount"
              />
            </div>
          ) : (
            <span className="text-sm font-medium">Enter a custom amount</span>
          )}
        </button>
      </div>

      {/* Donor details */}
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name">
            <Input
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder="Jane Wanjiru"
            />
          </Field>
          <Field label="Mobile number" hint="We'll send a mobile-money prompt here.">
            <Input
              type="tel"
              inputMode="tel"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              placeholder="0752 000 000"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email (optional)">
            <Input
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Message (optional)">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A note of support…"
            />
          </Field>
        </div>
      </div>

      <Button
        size="lg"
        className="group h-12 w-full rounded-full bg-gradient-to-r from-primary to-accent text-base shadow-glow transition-transform hover:scale-[1.01]"
        onClick={submit}
        disabled={pending}
      >
        <Heart className="size-5 transition-transform group-hover:scale-110" />
        {pending
          ? "Sending…"
          : charge > 0
            ? `Donate TSh ${formatNumber(charge)}`
            : "Donate Now"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" />
        Secure mobile-money payment — funds go straight to ORA.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
