"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Check,
  X,
  Users,
  Pencil,
  ChevronDown,
  ChevronRight,
  Banknote,
} from "lucide-react";
import {
  createEmployee,
  updateEmployee,
  createPayrollRun,
  approvePayrollRun,
  rejectPayrollRun,
  payPayrollRun,
} from "@/lib/actions/payroll";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/dashboard/action-button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export type EmployeeDTO = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  baseSalary: number;
  isActive: boolean;
};

export type PayrollItemDTO = {
  id: string;
  name: string;
  gross: number;
  allowance: number;
  deduction: number;
  net: number;
};

export type PayrollRunDTO = {
  id: string;
  code: string;
  month: number;
  year: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "REJECTED";
  createdByName: string;
  approvedByName: string | null;
  paidAt: string | null; // ISO
  note: string | null;
  createdAt: string; // ISO
  items: PayrollItemDTO[];
};

type ReceivingAccount = {
  id: string;
  name: string;
  type: string;
  accountName: string | null;
  accountNumber: string | null;
};

const RUN_VARIANT: Record<
  PayrollRunDTO["status"],
  "secondary" | "warning" | "info" | "success" | "destructive"
> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  PAID: "success",
  REJECTED: "destructive",
};

const RUN_LABEL: Record<PayrollRunDTO["status"], string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved — ready to pay",
  PAID: "Paid",
  REJECTED: "Rejected",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const runTotal = (r: PayrollRunDTO) => r.items.reduce((s, i) => s + i.net, 0);

/** Payroll: finance keeps the employee register and builds runs; admin
 * approves; finance pays. One component, two vantage points. */
export function PayrollManager({
  employees,
  runs,
  receivingAccounts,
  mode,
}: {
  employees: EmployeeDTO[];
  runs: PayrollRunDTO[];
  receivingAccounts: ReceivingAccount[];
  mode: "finance" | "admin";
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EmployeeDTO | null>(null);
  const [creatingRun, setCreatingRun] = useState(false);

  return (
    <div className="space-y-8">
      {/* Employee register */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="size-5 text-primary" /> Employees
          </h2>
          {mode === "finance" && (
            <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add employee
            </Button>
          )}
        </div>
        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add employees to the register to start running payroll."
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card">
            <Table wrapperClassName="table-stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Monthly salary</TableHead>
                  <TableHead>Status</TableHead>
                  {mode === "finance" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell data-cardtitle>
                      <div className="font-medium">{e.name}</div>
                      {e.phone && <div className="text-xs text-muted-foreground">{e.phone}</div>}
                    </TableCell>
                    <TableCell data-label="Position" className="text-sm text-muted-foreground">
                      {e.position ?? "—"}
                    </TableCell>
                    <TableCell data-label="Monthly salary" className="text-right font-medium">
                      {formatCurrency(e.baseSalary)}
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={e.isActive ? "success" : "secondary"}>
                        {e.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {mode === "finance" && (
                      <TableCell data-label="Actions" className="text-right">
                        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(e)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Payroll runs */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Banknote className="size-5 text-primary" /> Payroll runs
          </h2>
          {mode === "finance" && (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => setCreatingRun(true)}
              disabled={employees.filter((e) => e.isActive).length === 0}
            >
              <Plus className="size-4" /> New payroll run
            </Button>
          )}
        </div>
        {runs.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payroll runs yet"
            description="Build a run from the employee register — the admin approves it, then finance pays it out."
          />
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <RunCard key={r.id} run={r} mode={mode} accounts={receivingAccounts} onDone={() => router.refresh()} />
            ))}
          </div>
        )}
      </section>

      {adding && (
        <EmployeeModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <EmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {creatingRun && (
        <NewRunModal
          employees={employees.filter((e) => e.isActive)}
          onClose={() => setCreatingRun(false)}
          onDone={() => {
            setCreatingRun(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── One payroll run ──────────────────────────────────────────────────────────

function RunCard({
  run,
  mode,
  accounts,
  onDone,
}: {
  run: PayrollRunDTO;
  mode: "finance" | "admin";
  accounts: ReceivingAccount[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const total = runTotal(run);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {MONTHS[run.month - 1]} {run.year}
            <Badge variant={RUN_VARIANT[run.status]}>{RUN_LABEL[run.status]}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {run.code} · {run.items.length} employee{run.items.length === 1 ? "" : "s"} · built by {run.createdByName}{" "}
            {timeAgo(run.createdAt)}
            {run.approvedByName ? ` · reviewed by ${run.approvedByName}` : ""}
            {run.paidAt ? ` · paid ${timeAgo(run.paidAt)}` : ""}
          </p>
          {run.note && <p className="mt-1 text-xs text-muted-foreground">“{run.note}”</p>}
          <p className="mt-1.5 font-display text-xl font-bold">{formatCurrency(total)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {mode === "admin" && run.status === "PENDING_APPROVAL" && (
            <>
              <ActionButton
                size="sm"
                variant="success"
                action={() => approvePayrollRun(run.id)}
                onDone={onDone}
                pendingText="…"
              >
                <Check className="size-3.5" /> Approve
              </ActionButton>
              <ActionButton
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                action={() =>
                  rejectPayrollRun(run.id, window.prompt("Reason for rejecting (optional)") ?? undefined)
                }
                onDone={onDone}
                pendingText="…"
              >
                <X className="size-3.5" /> Reject
              </ActionButton>
            </>
          )}
          {mode === "finance" && run.status === "APPROVED" && (
            <>
              {accounts.length > 0 && (
                <Select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="h-8 max-w-44 text-xs"
                  title="Account the salaries are paid from"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.accountNumber ? ` · ${a.accountNumber}` : ""}
                    </option>
                  ))}
                </Select>
              )}
              <ActionButton
                size="sm"
                variant="success"
                confirm={`Pay ${formatCurrency(total)} in salaries for ${MONTHS[run.month - 1]} ${run.year}?`}
                action={() => payPayrollRun(run.id, accountId || undefined)}
                onDone={onDone}
                pendingText="Paying…"
              >
                <Banknote className="size-3.5" /> Pay run
              </ActionButton>
            </>
          )}
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {open ? "Hide" : "Details"}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto border-t border-border/60 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1.5 font-medium">Employee</th>
                <th className="pb-1.5 text-right font-medium">Gross</th>
                <th className="pb-1.5 text-right font-medium">Allowance</th>
                <th className="pb-1.5 text-right font-medium">Deduction</th>
                <th className="pb-1.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((i) => (
                <tr key={i.id} className="border-t border-border/40">
                  <td className="py-1.5">{i.name}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{formatNumber(i.gross)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">+{formatNumber(i.allowance)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">−{formatNumber(i.deduction)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(i.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Employee add/edit modal ──────────────────────────────────────────────────

function EmployeeModal({
  employee,
  onClose,
  onDone,
}: {
  employee?: EmployeeDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(employee?.name ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [salary, setSalary] = useState(employee ? String(employee.baseSalary) : "");
  const [active, setActive] = useState(employee?.isActive ?? true);

  function submit() {
    const baseSalary = Math.max(0, Math.round(Number(salary) || 0));
    if (name.trim().length < 2) {
      toast({ variant: "error", title: "Enter the employee's name." });
      return;
    }
    start(async () => {
      const res = employee
        ? await updateEmployee({
            employeeId: employee.id,
            name,
            position,
            phone,
            baseSalary,
            isActive: active,
          })
        : await createEmployee({ name, position, phone, baseSalary });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={employee ? `Edit · ${employee.name}` : "Add employee"}
      description="Payroll register — employees are paid people, not system logins."
    >
      <div className="space-y-4">
        <div>
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Position</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Driver" className="mt-1.5" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 …" className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Monthly salary (TSh)</Label>
          <Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} className="mt-1.5" />
        </div>
        {employee && (
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span>
              <span className="font-medium">On active payroll</span>
              <span className="block text-xs text-muted-foreground">
                Inactive employees are skipped when building new runs.
              </span>
            </span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-primary" />
          </label>
        )}
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : employee ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </Modal>
  );
}

// ── New run modal ────────────────────────────────────────────────────────────

function NewRunModal({
  employees,
  onClose,
  onDone,
}: {
  employees: EmployeeDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<
    Record<string, { gross: string; allowance: string; deduction: string }>
  >(() =>
    Object.fromEntries(
      employees.map((e) => [e.id, { gross: String(e.baseSalary), allowance: "", deduction: "" }]),
    ),
  );

  const get = (id: string) => lines[id] ?? { gross: "0", allowance: "", deduction: "" };
  const setField = (id: string, k: "gross" | "allowance" | "deduction", v: string) =>
    setLines((s) => ({ ...s, [id]: { ...get(id), [k]: v } }));
  const netOf = (id: string) => {
    const l = get(id);
    return Math.max(
      0,
      (Math.round(Number(l.gross)) || 0) +
        (Math.round(Number(l.allowance)) || 0) -
        (Math.round(Number(l.deduction)) || 0),
    );
  };
  const total = useMemo(
    () => employees.reduce((s, e) => s + netOf(e.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, employees],
  );

  function submit() {
    start(async () => {
      const res = await createPayrollRun({
        month,
        year,
        note,
        lines: employees.map((e) => {
          const l = get(e.id);
          return {
            employeeId: e.id,
            gross: Math.max(0, Math.round(Number(l.gross)) || 0),
            allowance: Math.max(0, Math.round(Number(l.allowance)) || 0),
            deduction: Math.max(0, Math.round(Number(l.deduction)) || 0),
          };
        }),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New payroll run"
      description="Lines start from each employee's monthly salary — adjust, then submit to the admin for approval."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Month</Label>
            <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="mt-1.5">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="mt-1.5">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {employees.map((e) => {
            const l = get(e.id);
            return (
              <div key={e.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs font-semibold text-primary">
                    net {formatCurrency(netOf(e.id))}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Gross</Label>
                    <Input type="number" min={0} value={l.gross} onChange={(ev) => setField(e.id, "gross", ev.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Allowance</Label>
                    <Input type="number" min={0} value={l.allowance} onChange={(ev) => setField(e.id, "allowance", ev.target.value)} placeholder="0" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Deduction</Label>
                    <Input type="number" min={0} value={l.deduction} onChange={(ev) => setField(e.id, "deduction", ev.target.value)} placeholder="0" className="mt-1 h-9" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the admin should know…" className="mt-1.5" />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Total net pay</span>
          <span className="font-display text-lg font-semibold">{formatCurrency(total)}</span>
        </div>

        <Button className="w-full" onClick={submit} disabled={pending || total <= 0}>
          {pending ? "Submitting…" : "Submit for admin approval"}
        </Button>
      </div>
    </Modal>
  );
}
