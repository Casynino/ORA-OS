import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeDevAuditSafe } from "@/lib/developer/audit";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { InfoCallout } from "@/components/developer/info";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDateTime, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEPTS = [
  { key: "sales", label: "Sales" },
  { key: "finance", label: "Finance" },
  { key: "warehouse", label: "Warehouse" },
  { key: "customers", label: "Customers" },
] as const;
type Dept = (typeof DEPTS)[number]["key"];

/** A compact read-only table. Cells are plain values — nothing here can edit data. */
function Section({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: (React.ReactNode[] & { key?: string })[];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Latest {rows.length} · read-only</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No records.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {head.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((cells, i) => (
                <TableRow key={i}>
                  {cells.map((c, j) => (
                    <TableCell key={j} className="whitespace-nowrap text-sm">
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const money = (n: number) => formatCurrency(n);
const status = (s: string) => <Badge variant="secondary">{humanize(s)}</Badge>;

export default async function DeveloperRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const me = await requireRole("DEVELOPER");
  const { d } = await searchParams;
  const dept: Dept = DEPTS.some((x) => x.key === d) ? (d as Dept) : "sales";

  await writeDevAuditSafe({
    actor: { id: me.id, name: me.name ?? "Developer" },
    action: "DEV_VIEW",
    entity: "Records",
    summary: `Developer viewed ${dept} records (read-only).`,
    outcome: "SUCCESS",
  });

  let body: React.ReactNode = null;

  if (dept === "sales") {
    const sales = await prisma.fieldSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { rep: { select: { name: true } }, customer: { select: { name: true } } },
    });
    body = (
      <Section
        title="Field sales"
        head={["Code", "When", "Rep", "Customer", "Type", "Total", "Paid", "Finance", "Voided"]}
        rows={sales.map((s) => [
          <span key="c" className="font-mono text-xs">{s.code}</span>,
          formatDateTime(s.createdAt),
          s.rep.name,
          s.customer?.name ?? s.customerName ?? "Walk-in",
          status(s.type),
          money(s.total),
          money(s.amountPaid),
          status(s.financeStatus),
          s.voided ? <Badge key="v" variant="destructive">Voided</Badge> : "—",
        ])}
      />
    );
  } else if (dept === "finance") {
    const [pays, exps, deps] = await Promise.all([
      prisma.fieldPayment.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { sale: { select: { code: true } }, recordedBy: { select: { name: true } } },
      }),
      prisma.expense.findMany({
        orderBy: { expenseDate: "desc" },
        take: 15,
        include: { recordedBy: { select: { name: true } } },
      }),
      prisma.cashDeposit.findMany({
        orderBy: { depositDate: "desc" },
        take: 10,
        include: { depositAccount: { select: { name: true } } },
      }),
    ]);
    body = (
      <div className="space-y-4">
        <Section
          title="Collections"
          head={["When", "Sale", "Amount", "Method", "By", "Finance"]}
          rows={pays.map((p) => [
            formatDateTime(p.createdAt),
            <span key="c" className="font-mono text-xs">{p.sale.code}</span>,
            money(p.amount),
            p.method ?? "—",
            p.recordedBy.name,
            status(p.financeStatus),
          ])}
        />
        <Section
          title="Expenses"
          head={["Code", "When", "Category", "Purpose", "Amount", "Source", "By"]}
          rows={exps.map((e) => [
            <span key="c" className="font-mono text-xs">{e.code}</span>,
            formatDateTime(e.expenseDate),
            humanize(e.category),
            e.purpose,
            money(e.amount),
            humanize(e.source),
            e.recordedBy.name,
          ])}
        />
        <Section
          title="Bank deposits"
          head={["Code", "Date", "Account", "Total"]}
          rows={deps.map((x) => [
            <span key="c" className="font-mono text-xs">{x.code}</span>,
            formatDateTime(x.depositDate),
            x.depositAccount.name,
            money(x.total),
          ])}
        />
      </div>
    );
  } else if (dept === "warehouse") {
    const [reqs, trfs, rets] = await Promise.all([
      prisma.repStockRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { rep: { select: { name: true } }, warehouse: { select: { name: true } } },
      }),
      prisma.warehouseTransfer.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { from: { select: { name: true } }, to: { select: { name: true } } },
      }),
      prisma.returnRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: { select: { name: true } }, requester: { select: { name: true } } },
      }),
    ]);
    body = (
      <div className="space-y-4">
        <Section
          title="Rep stock requests"
          head={["Code", "When", "Rep", "Warehouse", "Status"]}
          rows={reqs.map((r) => [
            <span key="c" className="font-mono text-xs">{r.code}</span>,
            formatDateTime(r.createdAt),
            r.rep.name,
            r.warehouse?.name ?? "—",
            status(r.status),
          ])}
        />
        <Section
          title="Transfers"
          head={["Code", "When", "From", "To", "Status"]}
          rows={trfs.map((t) => [
            <span key="c" className="font-mono text-xs">{t.code}</span>,
            formatDateTime(t.createdAt),
            t.from.name,
            t.to.name,
            status(t.status),
          ])}
        />
        <Section
          title="Returns"
          head={["Code", "When", "Product", "Qty", "By", "Status"]}
          rows={rets.map((r) => [
            <span key="c" className="font-mono text-xs">{r.code}</span>,
            formatDateTime(r.createdAt),
            r.product.name,
            r.quantity,
            r.requester.name,
            status(r.status),
          ])}
        />
      </div>
    );
  } else {
    const customers = await prisma.fieldCustomer.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { rep: { select: { name: true } } },
    });
    body = (
      <Section
        title="Customers"
        head={["Business", "Region", "Rep", "Credit limit", "Credit", "Added"]}
        rows={customers.map((c) => [
          c.businessName ?? c.name,
          c.region ?? "—",
          c.rep?.name ?? "Unassigned",
          c.creditLimit != null ? money(c.creditLimit) : "No cap",
          c.creditSuspended ? <Badge key="s" variant="destructive">Suspended</Badge> : <Badge key="s" variant="success">Open</Badge>,
          formatDateTime(c.createdAt),
        ])}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Business records"
        description="A look at the business data — sales, payments, stock and customers — in plain tables."
      />
      <InfoCallout icon={Eye} tone="neutral" title="Look, don't touch">
        This page is read-only: nothing here can be edited, so you can check a number safely. If a record is wrong, the
        person who owns it fixes it — or you can use{" "}
        <a href="/developer/users" className="font-medium text-primary hover:underline">
          Work as
        </a>{" "}
        to see their screen. Each visit to this page is recorded in the audit log.
      </InfoCallout>
      <div className="flex flex-wrap gap-1.5">
        {DEPTS.map((x) => (
          <Link
            key={x.key}
            href={`/developer/records?d=${x.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              dept === x.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
