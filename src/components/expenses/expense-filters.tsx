"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validators/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type FilterCategory = { id: string; name: string };

export function ExpenseFilters({ categories }: { categories: FilterCategory[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [min, setMin] = React.useState(searchParams.get("min") ?? "");
  const [max, setMax] = React.useState(searchParams.get("max") ?? "");
  const [debounceTimer, setDebounceTimer] = React.useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  function apply(partial: Record<string, string>, options?: { resetPage?: boolean }) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(partial)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    if (options?.resetPage !== false) sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  function onQueryChange(v: string) {
    setQ(v);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => apply({ q: v }), 350);
    setDebounceTimer(t);
  }

  const hasAny =
    searchParams.get("q") ??
    searchParams.get("category") ??
    searchParams.get("method") ??
    searchParams.get("from") ??
    searchParams.get("to") ??
    searchParams.get("min") ??
    searchParams.get("max");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search merchant or notes…"
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <Select
          className="w-44"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => apply({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={searchParams.get("method") ?? ""}
          onChange={(e) => apply({ method: e.target.value })}
        >
          <option value="">Any method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        {hasAny ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setMin("");
              setMax("");
              router.push(pathname);
            }}
          >
            <RotateCcw />
            Clear
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="w-40"
          aria-label="From date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => apply({ from: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          className="w-40"
          aria-label="To date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => apply({ to: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            className="w-28"
            placeholder="Min ₹"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={() => apply({ min })}
            onKeyDown={(e) => e.key === "Enter" && apply({ min })}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            inputMode="decimal"
            className="w-28"
            placeholder="Max ₹"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={() => apply({ max })}
            onKeyDown={(e) => e.key === "Enter" && apply({ max })}
          />
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/expenses/export" download>
            Export CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
