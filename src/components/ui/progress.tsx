import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  /** 0–100 */
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all duration-300", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
