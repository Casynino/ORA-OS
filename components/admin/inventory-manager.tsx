"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackagePlus, Settings2, AlertTriangle } from "lucide-react";
import {
  addStock,
  adjustStock,
} from "@/lib/actions/inventory";
import { createProduct } from "@/lib/actions/products";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { formatNumber, humanize } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitLabel: string;
  isActive: boolean;
  warehouseQty: number;
  assignedQty: number;
  distributedQty: number;
  lowStockThreshold: number;
};

type ModalState =
  | { type: "product" }
  | { type: "add"; product: Product }
  | { type: "adjust"; product: Product }
  | null;

export function InventoryManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setModal({ type: "product" })}>
          <PackagePlus className="size-4" />
          Add product
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Warehouse</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Distributed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const low = p.warehouseQty <= p.lowStockThreshold;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku} · {humanize(p.category)}
                        {!p.isActive && " · inactive"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(p.warehouseQty)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(p.assignedQty)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(p.distributedQty)}
                    </TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          Low
                        </Badge>
                      ) : (
                        <Badge variant="success">In stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModal({ type: "add", product: p })}
                        >
                          <Plus className="size-3.5" />
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ type: "adjust", product: p })}
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {modal?.type === "product" && (
        <ProductModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal?.type === "add" && (
        <AddStockModal
          product={modal.product}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal?.type === "adjust" && (
        <AdjustStockModal
          product={modal.product}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ProductModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "PADS",
    unitLabel: "pack",
    initialStock: "0",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    start(async () => {
      const res = await createProduct({
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        category: form.category as "PADS" | "HYGIENE" | "ACCESSORY" | "OTHER",
        unitLabel: form.unitLabel || undefined,
        initialStock: Number(form.initialStock) || 0,
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
    <Modal open onClose={onClose} title="Add product">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="ORA-REG-8"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-1.5"
            >
              <option value="PADS">Pads</option>
              <option value="HYGIENE">Hygiene</option>
              <option value="ACCESSORY">Accessory</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ora Regular Pads"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Unit label</Label>
            <Input
              value={form.unitLabel}
              onChange={(e) => set("unitLabel", e.target.value)}
              placeholder="pack of 8"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Initial stock</Label>
            <Input
              type="number"
              min={0}
              value={form.initialStock}
              onChange={(e) => set("initialStock", e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Creating…" : "Create product"}
        </Button>
      </div>
    </Modal>
  );
}

function AddStockModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [quantity, setQuantity] = useState("100");
  const [reference, setReference] = useState("");

  function submit() {
    start(async () => {
      const res = await addStock({
        productId: product.id,
        quantity: Number(quantity),
        reference: reference || undefined,
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
      title={`Add stock · ${product.name}`}
      description={`Current warehouse: ${formatNumber(product.warehouseQty)}`}
    >
      <div className="space-y-4">
        <div>
          <Label>Quantity received</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Delivery note #"
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Adding…" : "Add to warehouse"}
        </Button>
      </div>
    </Modal>
  );
}

function AdjustStockModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [quantity, setQuantity] = useState("-1");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await adjustStock({
        productId: product.id,
        quantity: Number(quantity),
        note: note || undefined,
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
      title={`Adjust stock · ${product.name}`}
      description="Use a negative number to remove (damage, loss). Logged for audit."
    >
      <div className="space-y-4">
        <div>
          <Label>Adjustment (+/-)</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Reason</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Damaged in transit…"
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Apply adjustment"}
        </Button>
      </div>
    </Modal>
  );
}
