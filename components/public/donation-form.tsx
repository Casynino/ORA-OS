"use client";

import { useState, useTransition } from "react";
import { HeartHandshake, Check, Droplets, Coins, PartyPopper } from "lucide-react";
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

export function DonationForm({ packages }: { packages: Pkg[] }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const [packageId, setPackageId] = useState<string | "custom">(
    packages[0]?.id ?? "custom",
  );
  const [type, setType] = useState<"PADS" | "MONEY">("MONEY");
  const [amount, setAmount] = useState("1000");
  const [quantity, setQuantity] = useState("50");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");

  const isCustom = packageId === "custom";

  function submit() {
    if (!donorName.trim()) {
      toast({ variant: "error", title: "Please enter your name." });
      return;
    }
    const input = isCustom
      ? {
          type,
          donorName,
          donorEmail: donorEmail || undefined,
          message: message || undefined,
          amount: type === "MONEY" ? Number(amount) : undefined,
          quantity: type === "PADS" ? Number(quantity) : undefined,
        }
      : {
          type: "MONEY" as const, // overridden server-side by package
          donorName,
          donorEmail: donorEmail || undefined,
          message: message || undefined,
          packageId,
        };

    startTransition(async () => {
      const res = await createDonation(input);
      if (res.ok) {
        setDone(res.data?.code ?? "");
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
            <PartyPopper className="size-7" />
          </span>
          <h3 className="mt-4 font-display text-xl font-semibold">
            Thank you, {donorName.split(" ")[0]}!
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Your donation has been recorded{done ? ` as ${done}` : ""}. Our team
            will confirm and allocate it to the communities that need it most.
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
        {pending ? "Recording your gift…" : "Complete donation"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No payment is collected here — our team will reach out to confirm and
        receive your donation securely.
      </p>
    </div>
  );
}
