"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-[3.75rem] items-center rounded-full border border-border bg-secondary/60 p-1 transition-colors",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-soft transition-transform duration-300",
          isDark ? "translate-x-[1.5rem]" : "translate-x-0",
        )}
      >
        {mounted && isDark ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </span>
    </button>
  );
}
