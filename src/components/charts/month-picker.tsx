"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonthKeys, monthKeyLabel } from "@/lib/dates";
import { Button } from "@/components/ui/button";

export function MonthPicker({ initialMonth }: { initialMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [month, setMonth] = React.useState(initialMonth);

  function go(delta: number) {
    const next = addMonthKeys(month, delta);
    setMonth(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("month", next);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => go(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-[7.5rem] text-center text-sm font-medium">
        {monthKeyLabel(month)}
      </span>
      <Button variant="outline" size="icon" aria-label="Next month" onClick={() => go(1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}
