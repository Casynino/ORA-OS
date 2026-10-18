"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, UserPlus } from "lucide-react";
import { devCreateUser } from "@/lib/actions/developer";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

type Role = "WAREHOUSE" | "PARTNER" | "SALES_REP" | "FINANCE" | "ADMIN";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "SALES_REP", label: "Sales rep", hint: "Sells in the field, collects payments and requests stock." },
  { value: "WAREHOUSE", label: "Warehouse staff", hint: "Receives and hands out stock for one warehouse. No money powers." },
  { value: "FINANCE", label: "Finance", hint: "Collects and checks payments, deposits cash, follows up debts." },
  { value: "PARTNER", label: "Partner", hint: "A customer or distributor who orders products." },
  { value: "ADMIN", label: "Admin (owner)", hint: "Full control of money, staff and reports. Use with care." },
];

/** 12 characters, no look-alikes (0/O, 1/l/I), from the browser's secure random source. */
function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

type Created = { name: string; email: string; password: string; role: string };

export function CreateAccountButton({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<Created | null>(null);

  const [role, setRole] = useState<Role>("SALES_REP");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [position, setPosition] = useState("");
  const [transfers, setTransfers] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function reset() {
    setRole("SALES_REP");
    setName("");
    setEmail("");
    setPhone("");
    setPassword(makePassword());
    setOrganization("");
    setWarehouseId(warehouses[0]?.id ?? "");
    setPosition("");
    setTransfers(false);
    setConfirmAdmin(false);
    setCreated(null);
  }
  function openNew() {
    reset();
    setOpen(true);
  }
  function close() {
    setOpen(false);
    if (created) router.refresh();
  }

  const roleInfo = ROLES.find((r) => r.value === role)!;
  const isWarehouse = role === "WAREHOUSE";

  function submit() {
    if (name.trim().length < 2) return toast({ variant: "error", title: "Enter the full name." });
    if (!email.includes("@")) return toast({ variant: "error", title: "Enter a valid email." });
    if (password.length < 8) return toast({ variant: "error", title: "The password needs at least 8 characters." });
    if (isWarehouse && !warehouseId) return toast({ variant: "error", title: "Choose the warehouse." });
    if (role === "ADMIN" && !confirmAdmin) return toast({ variant: "error", title: "Tick the box to confirm an Admin account." });
    start(async () => {
      const res = await devCreateUser({
        name,
        email,
        password,
        role,
        phone: phone || undefined,
        organization: role === "PARTNER" ? organization || undefined : undefined,
        warehouseId: isWarehouse ? warehouseId : undefined,
        position: isWarehouse ? position || undefined : undefined,
        canCreateTransfers: isWarehouse ? transfers : undefined,
        confirmAdmin: role === "ADMIN" ? true : undefined,
      });
      if (res.ok) {
        setCreated({ name: name.trim(), email: email.trim().toLowerCase(), password, role: roleInfo.label });
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const message = created
    ? `Hello ${created.name}, your ORA account is ready.\nSign in: ${loginUrl}\nEmail: ${created.email}\nPassword: ${created.password}\nPlease keep it private.`
    : "";
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast({ variant: "error", title: "Couldn't copy — select the text and copy it by hand." });
    }
  }

  return (
    <>
      <Button onClick={openNew}>
        <UserPlus className="size-4" /> New account
      </Button>

      {open && (
        <Modal
          open
          onClose={close}
          title={created ? "Account created" : "New account"}
          description={
            created
              ? `${created.name} can sign in now. Share these details with them.`
              : "Create a login for a team member, a partner, or the owner."
          }
        >
          {created ? (
            <div className="space-y-4">
              <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                {[
                  ["Name", created.name],
                  ["Role", created.role],
                  ["Email", created.email],
                  ["Password", created.password],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={k === "Password" ? "font-mono font-semibold" : "truncate font-medium"}>{v}</span>
                      {(k === "Email" || k === "Password") && (
                        <button
                          type="button"
                          onClick={() => copy(k, v)}
                          aria-label={`Copy ${k.toLowerCase()}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {copied === k ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The password is shown only here, once. It is stored scrambled and nobody (including you) can read it
                again. If it is lost, create a new password for them from the owner&apos;s Users page.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="flex-1" onClick={() => copy("all", message)}>
                  {copied === "all" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === "all" ? "Copied" : "Copy sign-in message"}
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
                >
                  Send on WhatsApp
                </a>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={reset}>
                  Create another
                </Button>
                <Button variant="ghost" onClick={close}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1.5">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">{roleInfo.hint}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" autoFocus />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" inputMode="tel" />
                </div>
              </div>

              <div>
                <Label>Email (their sign-in)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" autoComplete="off" />
              </div>

              <div>
                <Label>Password</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button type="button" variant="outline" onClick={() => setPassword(makePassword())} title="Make a new password">
                    <RefreshCw className="size-4" /> New
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  A strong password is made for you. You can type your own (8+ characters).
                </p>
              </div>

              {isWarehouse && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Warehouse</Label>
                    <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-1.5">
                      {warehouses.length === 0 && <option value="">No warehouses yet</option>}
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Job title (optional)</Label>
                    <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Stock controller" className="mt-1.5" />
                  </div>
                  <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={transfers}
                      onChange={(e) => setTransfers(e.target.checked)}
                      className="mt-0.5 size-4 rounded border-input accent-[hsl(var(--primary))]"
                    />
                    <span>
                      Can create transfers
                      <span className="block text-xs text-muted-foreground">Start transfers out of their warehouse.</span>
                    </span>
                  </label>
                </div>
              )}

              {role === "PARTNER" && (
                <div>
                  <Label>Organization (optional)</Label>
                  <Input value={organization} onChange={(e) => setOrganization(e.target.value)} className="mt-1.5" />
                </div>
              )}

              {role === "ADMIN" && (
                <label className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmAdmin}
                    onChange={(e) => setConfirmAdmin(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-input accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="font-semibold text-warning">This is an Admin (owner) account.</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      It can control money, payroll, staff and reports. The owner is told on WhatsApp that you created it.
                    </span>
                  </span>
                </label>
              )}

              <Button className="w-full" onClick={submit} disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
