"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowDownWideNarrow, ArrowDownAZ } from "lucide-react";
import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CategorySlice = { name: string; color: string; amountPaise: number };

type SortMode = "alphabetical" | "amount";

export function CategoryDonut({
  data,
  totalPaise,
}: {
  data: CategorySlice[];
  totalPaise: number;
}) {
  const [sort, setSort] = React.useState<SortMode>("alphabetical");

  // The server sends amount-descending; presentation order is chosen client-side:
  // alphabetical by category name by default, or by amount on demand.
  const slices = React.useMemo(() => {
    const base = data.slice(0, 10);
    return sort === "alphabetical"
      ? [...base].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      : [...base].sort((a, b) => b.amountPaise - a.amountPaise);
  }, [data, sort]);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No spending this month yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center justify-end gap-1"
        role="group"
        aria-label="Sort category breakdown"
      >
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={sort === "alphabetical"}
          aria-label="Sort by category name"
          className={cn("h-7 gap-1.5 px-2 text-xs", sort === "alphabetical" && "bg-secondary text-secondary-foreground")}
          onClick={() => setSort("alphabetical")}
        >
          <ArrowDownAZ />
          A–Z
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={sort === "amount"}
          aria-label="Sort by amount"
          className={cn("h-7 gap-1.5 px-2 text-xs", sort === "amount" && "bg-secondary text-secondary-foreground")}
          onClick={() => setSort("amount")}
        >
          <ArrowDownWideNarrow />
          By amount
        </Button>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-56 w-56 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="amountPaise"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatINR(value)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{formatINR(totalPaise)}</p>
          </div>
        </div>

        <ul className="w-full space-y-1.5">
          {slices.map((s) => {
            const pct = totalPaise > 0 ? Math.round((s.amountPaise / totalPaise) * 100) : 0;
            return (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                <span className="w-20 text-right font-medium tabular-nums">
                  {formatINRCompact(s.amountPaise)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
