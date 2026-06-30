"use client";

import { useState, useTransition } from "react";
import { HeartHandshake, Check, Droplets, Coins, PartyPopper, Smartphone } from "lucide-react";
import { createDonation } from "@/lib/actions/donations";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function DonationForm({ packages }: { packages: Pkg[] }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<DoneInfo | null>(null);

  const [packageId, setPackageId] = useState<string | "custom">(
    packages[0]?.id ?? "custom",
  );
  const [type, setType] = useState<"PADS" | "MONEY">("MONEY");
  const [amount, setAmount] = useState("1000");
  const [quantity, setQuantity] = useState("50");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");

  const isCustom = packageId === "custom";
  const selectedPkg = packages.find((p) => p.id === packageId);

  // The money that will be charged to the donor's phone (TSh).
  const charge = isCustom
    ? type === "MONEY"
      ? Number(amount) || 0
      : (Number(quantity) || 0) * PER_PAD_TZS
    : selectedPkg
      ? selectedPkg.type === "MONEY"
        ? selectedPkg.amount ?? 0
        : selectedPkg.amount ?? (selectedPkg.padsQuantity ?? 0) * PER_PAD_TZS
      : 0;

  function submit() {
    if (!donorName.trim()) {
      toast({ variant: "error", title: "Please enter your name." });
      return;
    }
    if (!donorPhone.trim()) {
      toast({ variant: "error", title: "Enter your mobile number to pay." });
      return;
    }
    const input = isCustom
      ? {
          type,
          donorName,
          donorEmail: donorEmail || undefined,
          donorPhone,
          message: message || undefined,
          amount: type === "MONEY" ? Number(amount) : undefined,
          quantity: type === "PADS" ? Number(quantity) : undefined,
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
      <Card className="shadow-glow">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            {done.paymentInitiated ? (
              <Smartphone className="size-7" />
            ) : (
              <PartyPopper className="size-7" />
            )}
          </span>
          <h3 className="mt-4 font-display text-xl font-semibold">
            {done.paymentInitiated
              ? "Approve the payment on your phone"
              : `Thank you, ${donorName.split(" ")[0]}!`}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {done.paymentInitiated ? (
              <>
                {done.instructions ??
                  "Check your phone for the mobile money prompt and enter your PIN to approve."}{" "}
                Your gift{done.code ? ` (${done.code})` : ""} is confirmed the
                moment payment clears.
              </>
            ) : (
              <>
                Your donation has been recorded{done.code ? ` as ${done.code}` : ""}.
                Our team will confirm and allocate it to the communities that
                need it most.
              </>
            )}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setDone(null);
              setMessage("");
            }}
          >
            Make another donation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {packages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => {
            const selected = packageId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPackageId(p.id)}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40",
                )}
              >
                {selected && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {p.type === "PADS" ? (
                    <Droplets className="size-4 text-accent" />
                  ) : (
                    <Coins className="size-4 text-primary" />
                  )}
                  <span className="font-semibold">{p.name}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
                <Badge variant="secondary" className="mt-3">
                  {p.type === "PADS"
                    ? `${formatNumber(p.padsQuantity ?? 0)} pads`
                    : `TSh ${formatNumber(p.amount ?? 0)}`}
                </Badge>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPackageId("custom")}
            className={cn(
              "rounded-xl border border-dashed p-4 text-left transition-all",
              isCustom
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="font-semibold">Custom donation</span>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your own amount or number of pads.
            </p>
          </button>
        </div>
      )}

      {isCustom && (
        <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Donation type</Label>
            <div className="mt-2 inline-flex rounded-lg bg-muted p-1">
              {(["MONEY", "PADS"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                    type === t
                      ? "bg-card shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {t === "MONEY" ? "Money" : "Pads"}
                </button>
              ))}
            </div>
          </div>
          {type === "MONEY" ? (
            <div>
              <Label htmlFor="amount">Amount (TSh)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="quantity">Number of pads</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="donorName">Your name</Label>
          <Input
            id="donorName"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Jane Wanjiru"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="donorPhone">Mobile number</Label>
          <Input
            id="donorPhone"
            type="tel"
            inputMode="tel"
            value={donorPhone}
            onChange={(e) => setDonorPhone(e.target.value)}
            placeholder="0752 000 000"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll send a mobile money prompt to this number.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="donorEmail">Email (optional)</Label>
        <Input
          id="donorEmail"
          type="email"
          value={donorEmail}
          onChange={(e) => setDonorEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note of support…"
          className="mt-1.5"
        />
      </div>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={pending}
      >
        <HeartHandshake className="size-5" />
        {pending
          ? "Sending payment request…"
          : charge > 0
            ? `Donate TSh ${formatNumber(charge)}`
            : "Complete donation"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Smartphone className="size-3.5" />
        Pay securely by mobile money — approve the prompt on your phone. Funds go
        straight to ORA.
      </p>
    </div>
  );
}
