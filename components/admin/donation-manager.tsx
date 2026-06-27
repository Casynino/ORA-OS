"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, HeartHandshake } from "lucide-react";
import { updateDonation } from "@/lib/actions/donations";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

type Donation = {
  id: string;
  code: string;
  type: string;
  donorName: string;
  donorEmail: string | null;
  amount: number | null;
  quantity: number | null;
  status: string;
  message: string | null;
  allocationNote: string | null;
  distributedTo: string | null;
  createdAt: string;
};

export function DonationManager({ donations }: { donations: Donation[] }) {
  const router = useRouter();
  const [active, setActive] = useState<Donation | null>(null);

  if (donations.length === 0) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title="No donations yet"
        description="Donations from the public site will appear here for allocation."
      />
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Gift</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell data-cardtitle>
                    <div className="font-medium">{d.donorName}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.code}
                      {d.donorEmail ? ` · ${d.donorEmail}` : ""}
                    </div>
                  </TableCell>
                  <TableCell data-label="Gift">
                    {d.type === "MONEY"
                      ? formatCurrency(d.amount)
                      : `${formatNumber(d.quantity ?? 0)} pads`}
                  </TableCell>
                  <TableCell data-label="Status">
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell data-label="Allocation" className="max-w-[180px] truncate text-sm text-muted-foreground">
                    {d.distributedTo ?? "—"}
                  </TableCell>
                  <TableCell data-label="Date" className="text-sm text-muted-foreground">
                    {formatDate(d.createdAt)}
                  </TableCell>
                  <TableCell data-label="Manage" className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActive(d)}
                    >
                      <Settings2 className="size-3.5" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {active && (
        <ManageModal
          donation={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ManageModal({
  donation,
  onClose,
  onDone,
}: {
  donation: Donation;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(donation.status);
  const [distributedTo, setDistributedTo] = useState(
    donation.distributedTo ?? "",
  );
  const [allocationNote, setAllocationNote] = useState(
    donation.allocationNote ?? "",
  );

  function submit() {
    start(async () => {
      const res = await updateDonation({
        donationId: donation.id,
        status: status as
          | "PENDING"
          | "RECEIVED"
          | "ALLOCATED"
          | "DISTRIBUTED"
          | "CANCELLED",
        distributedTo: distributedTo || undefined,
        allocationNote: allocationNote || undefined,
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
      title={`Donation · ${donation.code}`}
      description={`${donation.donorName} — ${
        donation.type === "MONEY"
          ? formatCurrency(donation.amount)
          : `${formatNumber(donation.quantity ?? 0)} pads`
      }`}
    >
      <div className="space-y-4">
        {donation.message && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm italic text-muted-foreground">
            “{donation.message}”
          </p>
        )}
        <div>
          <Label>Status</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1.5"
          >
            <option value="PENDING">Pending</option>
            <option value="RECEIVED">Received</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="DISTRIBUTED">Distributed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <div>
          <Label>Distributed to (beneficiary / region)</Label>
          <Input
            value={distributedTo}
            onChange={(e) => setDistributedTo(e.target.value)}
            placeholder="Kibera Girls School"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Allocation note</Label>
          <Textarea
            value={allocationNote}
            onChange={(e) => setAllocationNote(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Update donation"}
        </Button>
      </div>
    </Modal>
  );
}
