import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A focused number input steps its value when the wheel scrolls over it, and its
 * tiny steppers are easy to mis-click — both silently change a figure someone
 * already typed (a rep's quantity, an expense amount). So every number input
 * blurs on wheel and hides the steppers: what you type is what gets saved.
 */
const NUMBER_SAFE =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, onWheel, ...props }, ref) => {
  const isNumber = type === "number";
  return (
    <input
      type={type}
      ref={ref}
      onWheel={
        isNumber
          ? (e) => {
              e.currentTarget.blur();
              onWheel?.(e);
            }
          : onWheel
      }
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        isNumber && NUMBER_SAFE,
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
