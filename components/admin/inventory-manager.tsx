"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PackagePlus,
  Settings2,
  AlertTriangle,
  Boxes,
  Gift,
} from "lucide-react";
import { addStock, adjustStock } from "@/lib/actions/inventory";
import { createProduct, updateProduct } from "@/lib/actions/products";
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
import { QuantityInput } from "@/components/ui/quantity-input";
import { toast } from "@/components/ui/use-toast";
import { formatNumber, formatCurrency, humanize } from "@/lib/utils";
import { combineToPieces, splitQty } from "@/lib/units";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitLabel: string;
  iconKey: string;
  isActive: boolean;
  notForSale: boolean;
  unitsPerCarton: number;
  costPrice: number;
  price: number;
  description: string;
  warehouseQty: number;
  assignedQty: number;
  distributedQty: number;
  lowStockThreshold: number;
};

type Warehouse = { id: string; name: string };

type ModalState =
  | { type: "product" }
  | { type: "edit"; product: Product }
  | { type: "add"; product: Product }
  | { type: "adjust"; product: Product }
  | null;

/** "47,832 pcs / 1,993 cartons" style stock breakdown. */
function StockCell({ pieces, upc }: { pieces: number; upc: number }) {
  const { cartons, pieces: loose } = splitQty(pieces, upc);
  return (
    <div>
      <div className="font-semibold">{formatNumber(pieces)} pcs</div>
      <div className="text-xs text-muted-foreground">
        {formatNumber(cartons)} carton{cartons === 1 ? "" : "s"}
        {loose > 0 ? ` + ${formatNumber(loose)}` : ""}
      </div>
    </div>
  );
}

export function InventoryManager({
  products,
  warehouses,
  stockByWarehouse,
}: {
  products: Product[];
  warehouses: Warehouse[];
  stockByWarehouse: Record<string, Record<string, number>>;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const close = () => setModal(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Stock is stored in pieces. Receive & adjust in cartons, pieces, or both —
          conversion is automatic.
        </p>
        <Button onClick={() => setModal({ type: "product" })}>
          <PackagePlus className="size-4" />
          Add product
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="text-right">Carton</TableHead>
                <TableHead className="text-right">Sell price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const low = p.warehouseQty <= p.lowStockThreshold;
                const out = p.warehouseQty === 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell data-cardtitle>
                      <div className="flex items-center gap-1.5 font-medium">
                        {p.name}
                        {p.notForSale && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Gift className="size-2.5" />
                            Free
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku} · {humanize(p.category)}
                        {!p.isActive && " · inactive"}
                      </div>
                    </TableCell>
                    <TableCell data-label="In stock" className="text-right">
                      <div className="inline-block text-right">
                        <StockCell pieces={p.warehouseQty} upc={p.unitsPerCarton} />
                        {(p.assignedQty > 0 || p.distributedQty > 0) && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {p.assignedQty > 0 && `${formatNumber(p.assignedQty)} assigned`}
                            {p.assignedQty > 0 && p.distributedQty > 0 && " · "}
                            {p.distributedQty > 0 && `${formatNumber(p.distributedQty)} out`}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-label="Carton" className="text-right text-muted-foreground">
                      {formatNumber(p.unitsPerCarton)} pcs
                    </TableCell>
                    <TableCell data-label="Sell price" className="text-right">
                      {p.notForSale ? (
                        <span className="font-medium text-success">Free</span>
                      ) : (
                        <span className="font-medium">{formatCurrency(p.price)}</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Status">
                      {out ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          Out
                        </Badge>
                      ) : low ? (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="size-3" />
                          Low
                        </Badge>
                      ) : (
                        <Badge variant="success">In stock</Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModal({ type: "add", product: p })}
                        >
                          <Plus className="size-3.5" />
                          Receive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ type: "adjust", product: p })}
                          title="Adjust count"
                        >
                          <Boxes className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ type: "edit", product: p })}
                          title="Edit product"
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
        <ProductModal onClose={close} onDone={done} />
      )}
      {modal?.type === "edit" && (
        <EditProductModal product={modal.product} onClose={close} onDone={done} />
      )}
      {modal?.type === "add" && (
        <AddStockModal
          product={modal.product}
          warehouses={warehouses}
          stockByWarehouse={stockByWarehouse}
          onClose={close}
          onDone={done}
        />
      )}
      {modal?.type === "adjust" && (
        <AdjustStockModal
          product={modal.product}
          warehouses={warehouses}
          stockByWarehouse={stockByWarehouse}
          onClose={close}
          onDone={done}
        />
      )}
    </>
  );
}

// ── Create product ───────────────────────────────────────────────────────────
function ProductModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "PADS",
    unitLabel: "",
    unitsPerCarton: "24",
    costPrice: "0",
    price: "0",
    notForSale: false,
  });
  const [cartons, setCartons] = useState("0");
  const [pieces, setPieces] = useState("0");
  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const upc = Math.max(1, Number(form.unitsPerCarton) || 1);
  const initialStock = combineToPieces(Number(cartons), Number(pieces), upc);

  function submit() {
    start(async () => {
      const res = await createProduct({
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        category: form.category as "PADS" | "HYGIENE" | "ACCESSORY" | "OTHER",
        unitLabel: form.unitLabel || undefined,
        unitsPerCarton: upc,
        costPrice: Number(form.costPrice) || 0,
        price: form.notForSale ? 0 : Number(form.price) || 0,
        notForSale: form.notForSale,
        initialStock,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else toast({ variant: "error", title: res.error });
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
              placeholder="ORA-360"
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
            placeholder="ORA Pads 360mm Purple Night"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Unit label</Label>
          <Input
            value={form.unitLabel}
            onChange={(e) => set("unitLabel", e.target.value)}
            placeholder="360mm · Night Flow"
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Pieces / carton</Label>
            <Input
              type="number"
              min={1}
              value={form.unitsPerCarton}
              onChange={(e) => set("unitsPerCarton", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Cost / piece</Label>
            <Input
              type="number"
              min={0}
              value={form.costPrice}
              onChange={(e) => set("costPrice", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Sell / piece</Label>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              disabled={form.notForSale}
              className="mt-1.5"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-border/60 p-3 text-sm">
          <input
            type="checkbox"
            checked={form.notForSale}
            onChange={(e) => set("notForSale", e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>
            <span className="font-medium">Not for sale</span> — free sample / outreach
            item (no selling price).
          </span>
        </label>

        <div>
          <Label className="mb-1.5 block">Opening stock (optional)</Label>
          <QuantityInput
            unitsPerCarton={upc}
            cartons={cartons}
            pieces={pieces}
            onCartons={setCartons}
            onPieces={setPieces}
          />
        </div>

        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Creating…" : "Create product"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Edit product ─────────────────────────────────────────────────────────────
function EditProductModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    category: product.category,
    unitLabel: product.unitLabel,
    unitsPerCarton: String(product.unitsPerCarton),
    costPrice: String(product.costPrice),
    price: String(product.price),
    notForSale: product.notForSale,
    isActive: product.isActive,
  });
  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    start(async () => {
      const res = await updateProduct({
        productId: product.id,
        name: form.name,
        description: form.description,
        category: form.category as "PADS" | "HYGIENE" | "ACCESSORY" | "OTHER",
        unitLabel: form.unitLabel,
        unitsPerCarton: Math.max(1, Number(form.unitsPerCarton) || 1),
        costPrice: Number(form.costPrice) || 0,
        price: form.notForSale ? 0 : Number(form.price) || 0,
        notForSale: form.notForSale,
        isActive: form.isActive,
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
      title={`Edit · ${product.name}`}
      description={`${product.sku} — changes apply everywhere instantly. Stock isn't affected here.`}
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <Label>Unit label</Label>
            <Input
              value={form.unitLabel}
              onChange={(e) => set("unitLabel", e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Pieces / carton</Label>
            <Input
              type="number"
              min={1}
              value={form.unitsPerCarton}
              onChange={(e) => set("unitsPerCarton", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Cost / piece</Label>
            <Input
              type="number"
              min={0}
              value={form.costPrice}
              onChange={(e) => set("costPrice", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Sell / piece</Label>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              disabled={form.notForSale}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 rounded-xl border border-border/60 p-3 text-sm">
            <input
              type="checkbox"
              checked={form.notForSale}
              onChange={(e) => set("notForSale", e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="font-medium">Not for sale (free)</span>
          </label>
          <label className="flex items-center gap-2.5 rounded-xl border border-border/60 p-3 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="font-medium">Active</span>
          </label>
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={pending || form.name.trim().length < 2}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Receive stock ────────────────────────────────────────────────────────────
function AddStockModal({
  product,
  warehouses,
  stockByWarehouse,
  onClose,
  onDone,
}: {
  product: Product;
  warehouses: Warehouse[];
  stockByWarehouse: Record<string, Record<string, number>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [cartons, setCartons] = useState("1");
  const [pieces, setPieces] = useState("0");
  const [reference, setReference] = useState("");

  const qty = combineToPieces(Number(cartons), Number(pieces), product.unitsPerCarton);
  const current = stockByWarehouse[product.id]?.[warehouseId] ?? 0;
  const whName = warehouses.find((w) => w.id === warehouseId)?.name ?? "warehouse";

  function submit() {
    if (!warehouseId) {
      toast({ variant: "error", title: "Pick a warehouse first." });
      return;
    }
    start(async () => {
      const res = await addStock({
        productId: product.id,
        quantity: qty,
        warehouseId,
        reference: reference || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal open onClose={onClose} title={`Receive stock · ${product.name}`}>
      <div className="space-y-4">
        {warehouses.length > 1 && (
          <div>
            <Label>Into which warehouse?</Label>
            <Select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1.5"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {formatNumber(stockByWarehouse[product.id]?.[w.id] ?? 0)} on hand
                </option>
              ))}
            </Select>
          </div>
        )}

        <QuantityInput
          unitsPerCarton={product.unitsPerCarton}
          cartons={cartons}
          pieces={pieces}
          onCartons={setCartons}
          onPieces={setPieces}
          autoFocus
        />

        <div>
          <Label>Reference (optional)</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Delivery note #"
            className="mt-1.5"
          />
        </div>

        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">{whName}: </span>
          <span className="font-medium">{formatNumber(current)}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-semibold text-success">{formatNumber(current + qty)}</span>
          <span className="text-muted-foreground"> pcs</span>
        </div>

        <Button className="w-full" onClick={submit} disabled={pending || qty < 1}>
          {pending ? "Adding…" : `Receive ${formatNumber(qty)} pcs`}
        </Button>
      </div>
    </Modal>
  );
}

// ── Adjust stock ─────────────────────────────────────────────────────────────
function AdjustStockModal({
  product,
  warehouses,
  stockByWarehouse,
  onClose,
  onDone,
}: {
  product: Product;
  warehouses: Warehouse[];
  stockByWarehouse: Record<string, Record<string, number>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [mode, setMode] = useState<"add" | "remove">("remove");
  const [cartons, setCartons] = useState("0");
  const [pieces, setPieces] = useState("0");
  const [note, setNote] = useState("");

  const qty = combineToPieces(Number(cartons), Number(pieces), product.unitsPerCarton);
  const current = stockByWarehouse[product.id]?.[warehouseId] ?? 0;
  const whName = warehouses.find((w) => w.id === warehouseId)?.name ?? "warehouse";
  const next = mode === "add" ? current + qty : current - qty;
  const tooMany = mode === "remove" && qty > current;

  function submit() {
    if (!warehouseId) {
      toast({ variant: "error", title: "Pick a warehouse first." });
      return;
    }
    start(async () => {
      const res = await adjustStock({
        productId: product.id,
        quantity: mode === "add" ? qty : -qty,
        warehouseId,
        note: note || undefined,
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
      title={`Adjust stock · ${product.name}`}
      description="Correct a count (recount, damage, loss). Logged for audit."
    >
      <div className="space-y-4">
        {warehouses.length > 1 && (
          <div>
            <Label>Which warehouse?</Label>
            <Select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1.5"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {formatNumber(stockByWarehouse[product.id]?.[w.id] ?? 0)} on hand
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {(["remove", "add"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? m === "remove"
                    ? "bg-destructive text-destructive-foreground shadow-sm"
                    : "bg-success text-success-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "remove" ? "Remove" : "Add"}
            </button>
          ))}
        </div>

        <QuantityInput
          unitsPerCarton={product.unitsPerCarton}
          cartons={cartons}
          pieces={pieces}
          onCartons={setCartons}
          onPieces={setPieces}
        />

        <div>
          <Label>Reason</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "remove" ? "Damaged, lost, recount…" : "Found, recount…"}
            className="mt-1.5"
          />
        </div>

        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">{whName}: </span>
          <span className="font-medium">{formatNumber(current)}</span>
          <span className="text-muted-foreground"> → </span>
          <span
            className={`font-semibold ${
              tooMany ? "text-destructive" : mode === "add" ? "text-success" : "text-warning"
            }`}
          >
            {formatNumber(Math.max(0, next))}
          </span>
          <span className="text-muted-foreground"> pcs</span>
          {tooMany && (
            <p className="mt-1 text-xs text-destructive">
              Only {formatNumber(current)} on hand in {whName}.
            </p>
          )}
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={pending || qty < 1 || tooMany}
        >
          {pending
            ? "Saving…"
            : mode === "add"
              ? `Add ${formatNumber(qty)} pcs`
              : `Remove ${formatNumber(qty)} pcs`}
        </Button>
      </div>
    </Modal>
  );
}
