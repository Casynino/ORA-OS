"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
};

let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l([...items]);
}

export function toast(input: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).slice(2);
  items = [...items, { id, ...input }];
  emit();
  setTimeout(() => dismissToast(id), 4500);
  return id;
}

export function dismissToast(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts() {
  const [state, setState] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
