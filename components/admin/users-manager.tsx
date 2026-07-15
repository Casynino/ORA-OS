"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Ban, RotateCcw, CreditCard, Coins, UserPlus, Shield } from "lucide-react";
import {
  approveAgent,
  setUserStatus,
  setCreditLimit,
  createUserByAdmin,
  setWarehousePermissions,
} from "@/lib/actions/users";
import { setPartnerPrices } from "@/lib/actions/partner-pricing";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, humanize } from "@/lib/utils";

type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  organization: string | null;
  location: string | null;
  creditLimit: number | null;
  prices: Record<string, number>;
  canRecordSales?: boolean;
  canCreateTransfers?: boolean;
};

type ProductDTO = { id: string; name: string; sku: string; price: number };
type WarehouseDTO = { id: string; name: string };

const roleVariant: Record<string, "default" | "accent" | "info" | "success"> = {
  ADMIN: "default",
  PARTNER: "accent",
  WAREHOUSE: "info",
  SALES_REP: "success",
};

const TABS = ["ALL", "PENDING", "PARTNER", "WAREHOUSE", "SALES_REP", "ADMIN"];

export function UsersManager({
  users,
  products,
  warehouses = [],
}: {
  users: UserDTO[];
  products: ProductDTO[];
  warehouses?: WarehouseDTO[];
}) {
  const router = useRouter();
  const [creditFor, setCreditFor] = useState<UserDTO | null>(null);
  const [pricingFor, setPricingFor] = useState<UserDTO | null>(null);
  const [permsFor, setPermsFor] = useState<UserDTO | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = (tab: string) => {
    if (tab === "ALL") return users;
    if (tab === "PENDING") return users.filter((u) => u.status === "PENDING");
    return users.filter((u) => u.role === tab);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="size-4" />
          New user
        </Button>
      </div>
      <Tabs defaultValue="ALL">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {humanize(t)}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {filtered(t).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardContent className="p-0">
                <Table wrapperClassName="table-stack">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Credit limit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered(t).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell data-cardtitle>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                            {u.organization ? ` · ${u.organization}` : ""}
                          </div>
                        </TableCell>
                        <TableCell data-label="Role">
                          <Badge variant={roleVariant[u.role] ?? "secondary"}>
                            {humanize(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell data-label="Status">
                          <StatusBadge status={u.status} />
                        </TableCell>
                        <TableCell data-label="Credit limit" className="text-sm">
                          {u.role === "PARTNER"
                            ? u.creditLimit != null
                              ? formatCurrency(u.creditLimit)
                              : "—"
                            : "n/a"}
                        </TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex justify-end gap-1.5">
                            {u.status === "PENDING" && (
                              <ActionButton
                                size="sm"
                                variant="success"
                                action={() => approveAgent(u.id)}
                                onDone={() => router.refresh()}
                                pendingText="…"
                              >
                                <Check className="size-3.5" />
                                Approve
                              </ActionButton>
                            )}
                            {u.role === "PARTNER" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPricingFor(u)}
                              >
                                <Coins className="size-3.5" />
                                Prices
                              </Button>
                            )}
                            {u.role === "PARTNER" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCreditFor(u)}
                              >
                                <CreditCard className="size-3.5" />
                              </Button>
                            )}
                            {u.role === "WAREHOUSE" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPermsFor(u)}
                              >
                                <Shield className="size-3.5" />
                                Permissions
                              </Button>
                            )}
                            {u.status === "ACTIVE" && u.role !== "ADMIN" && (
                              <ActionButton
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10"
                                action={() =>
                                  setUserStatus({
                                    userId: u.id,
                                    status: "SUSPENDED",
                                  })
                                }
                                confirm={`Suspend ${u.name}?`}
                                onDone={() => router.refresh()}
                                pendingText="…"
                              >
                                <Ban className="size-3.5" />
                              </ActionButton>
                            )}
                            {u.status === "SUSPENDED" && (
                              <ActionButton
                                size="sm"
                                variant="outline"
                                action={() =>
                                  setUserStatus({
                                    userId: u.id,
                                    status: "ACTIVE",
                                  })
                                }
                                onDone={() => router.refresh()}
                                pendingText="…"
                              >
                                <RotateCcw className="size-3.5" />
                              </ActionButton>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {creditFor && (
        <CreditLimitModal
          user={creditFor}
          onClose={() => setCreditFor(null)}
          onDone={() => {
            setCreditFor(null);
            router.refresh();
          }}
        />
      )}

      {pricingFor && (
        <PartnerPricingModal
          user={pricingFor}
          products={products}
          onClose={() => setPricingFor(null)}
          onDone={() => {
            setPricingFor(null);
            router.refresh();
          }}
        />
      )}

      {creating && (
        <CreateUserModal
          warehouses={warehouses}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {permsFor && (
        <PermissionsModal
          user={permsFor}
          onClose={() => setPermsFor(null)}
          onDone={() => {
            setPermsFor(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PermissionToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function PermissionsModal({
  user,
  onClose,
  onDone,
}: {
  user: UserDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [transfers, setTransfers] = useState(!!user.canCreateTransfers);

  function submit() {
    start(async () => {
      const res = await setWarehousePermissions({
        userId: user.id,
        canRecordSales: false, // warehouse staff never record sales
        canCreateTransfers: transfers,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title={`Permissions · ${user.name}`} description="Operational permissions for this warehouse staff member.">
      <div className="space-y-3">
        <PermissionToggle
          label="Create transfers"
          hint="Allow starting stock transfers out of their warehouse."
          checked={transfers}
          onChange={setTransfers}
        />
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </Modal>
  );
}

function CreateUserModal({
  warehouses,
  onClose,
  onDone,
}: {
  warehouses: WarehouseDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [role, setRole] = useState<"WAREHOUSE" | "PARTNER" | "ADMIN" | "SALES_REP">("WAREHOUSE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [organization, setOrganization] = useState("");
  const [canCreateTransfers, setCanCreateTransfers] = useState(false);

  const isWarehouse = role === "WAREHOUSE";

  function submit() {
    if (name.trim().length < 2 || !email || password.length < 8) {
      toast({ variant: "error", title: "Name, a valid email and an 8+ char password are required." });
      return;
    }
    if (isWarehouse && !warehouseId) {
      toast({ variant: "error", title: "Assign the warehouse for this staff member." });
      return;
    }
    start(async () => {
      const res = await createUserByAdmin({
        name,
        email,
        password,
        role,
        phone: phone || undefined,
        position: isWarehouse ? position || undefined : undefined,
        warehouseId: isWarehouse ? warehouseId : undefined,
        canCreateTransfers: isWarehouse ? canCreateTransfers : undefined,
        organization: role === "PARTNER" ? organization || undefined : undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create user"
      description="Add an ORA team member or partner account. Warehouse staff are tied to one warehouse."
    >
      <div className="space-y-4">
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="mt-1.5">
            <option value="WAREHOUSE">Warehouse staff</option>
            <option value="PARTNER">Partner</option>
            <option value="SALES_REP">Sales rep</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="mt-1.5" />
          </div>
        </div>

        {isWarehouse && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Warehouse</Label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-1.5">
                {warehouses.length === 0 && <option value="">No warehouses</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Position</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Stock Controller" className="mt-1.5" />
            </div>
          </div>
        )}

        {isWarehouse && (
          <div className="space-y-2">
            <Label>Permissions</Label>
            <PermissionToggle
              label="Create transfers"
              hint="Start transfers out of their warehouse."
              checked={canCreateTransfers}
              onChange={setCanCreateTransfers}
            />
          </div>
        )}

        {role === "PARTNER" && (
          <div>
            <Label>Organization</Label>
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)} className="mt-1.5" />
          </div>
        )}

        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </Modal>
  );
}

function PartnerPricingModal({
  user,
  products,
  onClose,
  onDone,
}: {
  user: UserDTO;
  products: ProductDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      products.map((p) => [
        p.id,
        (user.prices[p.id] ?? p.price ?? 0).toString(),
      ]),
    ),
  );

  function submit() {
    start(async () => {
      const res = await setPartnerPrices({
        partnerId: user.id,
        prices: products.map((p) => ({
          productId: p.id,
          price: Math.max(0, Math.round(Number(prices[p.id]) || 0)),
        })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Partner pricing · ${user.organization ?? user.name}`}
      description="Set this partner's unit price (TSh) for each product. They only ever see their own prices."
    >
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku} · standard {formatCurrency(p.price)}
              </p>
            </div>
            <div className="w-32">
              <Label className="sr-only">Unit price</Label>
              <Input
                type="number"
                min={0}
                value={prices[p.id]}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
              />
            </div>
          </div>
        ))}
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save partner pricing"}
        </Button>
      </div>
    </Modal>
  );
}

function CreditLimitModal({
  user,
  onClose,
  onDone,
}: {
  user: UserDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [limit, setLimit] = useState((user.creditLimit ?? 0).toString());

  function submit() {
    start(async () => {
      const res = await setCreditLimit({
        userId: user.id,
        creditLimit: Number(limit) || 0,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title={`Credit limit · ${user.name}`}>
      <div className="space-y-4">
        <div>
          <Label>Credit ceiling (TSh)</Label>
          <Input
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save limit"}
        </Button>
      </div>
    </Modal>
  );
}
