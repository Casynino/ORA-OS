"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { createWarehouse, updateWarehouse } from "@/lib/actions/warehouses";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export function NewWarehouseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");

  function submit() {
    if (name.trim().length < 2) {
      toast({ variant: "error", title: "Enter a warehouse name." });
      return;
    }
    start(async () => {
      const res = await createWarehouse({
        name,
        location: location || undefined,
        capacity: capacity ? Number(capacity) : undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setName("");
        setLocation("");
        setCapacity("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New warehouse
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New warehouse" description="Add a warehouse to the ORA network.">
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arusha Warehouse" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / region" className="mt-1.5" />
              </div>
              <div>
                <Label>Capacity (units)</Label>
                <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Creating…" : "Create warehouse"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function EditWarehouseButton({
  warehouse,
}: {
  warehouse: { id: string; name: string; location: string | null; capacity: number | null; status: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState(warehouse.name);
  const [location, setLocation] = useState(warehouse.location ?? "");
  const [capacity, setCapacity] = useState(warehouse.capacity?.toString() ?? "");
  const [status, setStatus] = useState(warehouse.status);

  function submit() {
    start(async () => {
      const res = await updateWarehouse({
        id: warehouse.id,
        name,
        location: location || undefined,
        capacity: capacity ? Number(capacity) : null,
        status: status as "ACTIVE" | "OFFLINE" | "MAINTENANCE",
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={`Edit ${warehouse.name}`} description="Update warehouse details and status.">
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Capacity (units)</Label>
                <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1.5">
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OFFLINE">Offline</option>
              </Select>
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
