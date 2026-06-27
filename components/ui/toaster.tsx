"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dismissToast,
  useToasts,
  type ToastVariant,
} from "./use-toast";

const config: Record<
  ToastVariant,
  { icon: typeof Info; className: string }
> = {
  default: { icon: Info, className: "text-foreground" },
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: XCircle, className: "text-destructive" },
  warning: { icon: AlertTriangle, className: "text-warning" },
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, className } = config[t.variant ?? "default"];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-soft"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", className)} />
            <div className="flex-1">
              {t.title && (
                <p className="text-sm font-semibold">{t.title}</p>
              )}
              {t.description && (
                <p className="text-sm text-muted-foreground">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
