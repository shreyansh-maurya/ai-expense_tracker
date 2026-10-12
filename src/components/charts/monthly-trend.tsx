"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR, formatINRCompact } from "@/lib/money";

export type TrendPoint = { monthKey: string; label: string; amountPaise: number };

export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatINRCompact(v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value: number) => [formatINR(value), "Spent"]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
            cursor={{ stroke: "var(--color-border)" }}
          />
          <Area
            type="monotone"
            dataKey="amountPaise"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#trendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
