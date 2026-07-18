"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExpenseCategory } from "@/lib/actions/expense-categories";
import { toast } from "@/components/ui/use-toast";
import type { CategoryOption } from "@/lib/expense-categories";
import type { ExpenseCategory } from "@prisma/client";

const NEW = "__new__";

/**
 * Category picker shared by every expense/fund form. Renders preset groups +
 * custom categories, plus an inline "+ New category" that persists a custom one
 * (via createExpenseCategory) and selects it immediately. Controlled by the
 * normalized `{ category, customCategory }` pair the row stores — the picker
 * hides the preset-vs-custom mapping from the parent.
 */
export function CategorySelect({
  categories,
  category,
  customCategory,
  onChange,
  label = "Category",
}: {
  categories: CategoryOption[];
  category: string;
  customCategory: string | null;
  onChange: (v: { category: string; customCategory: string | null }) => void;
  label?: string;
}) {
  const [opts, setOpts] = useState<CategoryOption[]>(categories);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();

  // Group headings in stable order (presets in their given order, Custom last).
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const o of opts) if (!seen.includes(o.group)) seen.push(o.group);
    return seen;
  }, [opts]);

  const selectedValue = customCategory
    ? opts.find((o) => o.customCategory?.toLowerCase() === customCategory.toLowerCase())?.value ?? ""
    : opts.find((o) => !o.customCategory && o.category === category)?.value ?? "";

  function handleSelect(v: string) {
    if (v === NEW) {
      setCreating(true);
      return;
    }
    const o = opts.find((x) => x.value === v);
    if (o) onChange({ category: o.category, customCategory: o.customCategory });
  }

  function createNew() {
    const name = newName.trim();
    if (name.length < 2) return;
    start(async () => {
      const res = await createExpenseCategory({ name });
      if (!res.ok) {
        toast({ variant: "error", title: res.error });
        return;
      }
      if (res.data) {
        const created: CategoryOption = {
          value: `c:${res.data.id}`,
          label: res.data.name,
          category: res.data.group as ExpenseCategory,
          customCategory: res.data.name,
          group: "Custom",
        };
        setOpts((prev) => (prev.some((o) => o.value === created.value) ? prev : [...prev, created]));
        onChange({ category: created.category, customCategory: created.customCategory });
        setNewName("");
      }
      setCreating(false);
      toast({ variant: "success", title: res.message });
    });
  }

  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <Select value={selectedValue} onChange={(e) => handleSelect(e.target.value)} className={label ? "mt-1.5" : ""}>
        {selectedValue === "" && <option value="" disabled>Select a category</option>}
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {opts
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
        <option value={NEW}>+ New category…</option>
      </Select>
      {creating && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createNew())}
            placeholder="New category name"
            className="h-9"
            autoFocus
          />
          <Button size="sm" disabled={pending || newName.trim().length < 2} onClick={createNew}>
            <Plus className="size-3.5" /> {pending ? "…" : "Add"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
