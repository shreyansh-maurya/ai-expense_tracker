"use client";

import * as React from "react";
import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { detectMapping, mapRow, type ColumnMapping } from "@/lib/csv/core";
import { importExpenseRowsAction } from "@/lib/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FIELDS = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "category", label: "Category" },
  { key: "paymentMethod", label: "Payment method" },
  { key: "merchant", label: "Merchant" },
  { key: "notes", label: "Notes" },
] as const;

type MappedRow = ReturnType<typeof mapRow>;

const REQUIRED: Array<(typeof FIELDS)[number]["key"]> = ["date", "amount", "category"];

export function ImportWizard({ knownCategories }: { knownCategories: string[] }) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});

  const mapped = React.useMemo(
    () => rows.map((r, i) => mapRow(i, r, mapping, knownCategories)),
    [rows, mapping, knownCategories]
  );
  const invalidCount = mapped.filter((r) => r.errors.length > 0).length;

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = (meta.fields ?? []).filter((f): f is string => Boolean(f));
        setHeaders(cols);
        setRows(data);
        setMapping(detectMapping(cols));
        setFileName(file.name);
      },
      error: (err) => toast.error(`Could not parse CSV: ${err.message}`),
    });
  }

  function setField(field: string, column: string) {
    setMapping((prev) => {
      const next: ColumnMapping = { ...prev };
      for (const [f, col] of Object.entries(next)) {
        if (col === column && f !== field) delete next[f as keyof ColumnMapping];
      }
      if (column) next[field as keyof ColumnMapping] = column;
      else delete next[field as keyof ColumnMapping];
      return next;
    });
  }

  async function handleImport(opts: { createMissingCategories: boolean; skipDuplicates: boolean }) {
    const payload = mapped
      .filter((r) => r.errors.length === 0)
      .map((r) => ({
        dateISO: r.dateISO!,
        amountPaise: r.amountPaise!,
        categoryName: r.categoryName,
        paymentMethod: r.paymentMethod,
        merchant: r.merchant,
        notes: r.notes,
      }));
    if (payload.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    const res = await importExpenseRowsAction(payload, opts);
    if (res.ok) {
      const { created, skippedInvalid, skippedDuplicates, categoriesCreated } = res.result;
      toast.success(
        `Imported ${created} expense${created === 1 ? "" : "s"}` +
          (skippedDuplicates ? ` · ${skippedDuplicates} duplicate(s) skipped` : "") +
          (skippedInvalid ? ` · ${skippedInvalid} invalid skipped` : "") +
          (categoriesCreated ? ` · ${categoriesCreated} new categor${categoriesCreated === 1 ? "y" : "ies"}` : "")
      );
      setRows([]);
      setHeaders([]);
      setMapping({});
      setFileName(null);
    } else {
      toast.error(res.error);
    }
  }

  if (!fileName) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Choose a CSV file"
        description="Download bank statements or use our template format. Dates like 06/10/2026 or 2026-10-06 both work."
        className="min-h-64"
        action={
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              <Upload />
              Select CSV file
            </span>
          </label>
        }
      />
    );
  }

  const missingRequired = REQUIRED.filter((f) => !mapping[f]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          <span className="font-medium">{fileName}</span>
          <Badge variant="secondary">{rows.length} rows</Badge>
          {invalidCount > 0 ? (
            <Badge variant="destructive">{invalidCount} invalid</Badge>
          ) : (
            <Badge className="bg-green-500/15 text-green-600">All valid</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setRows([]);
            setHeaders([]);
            setMapping({});
            setFileName(null);
          }}
        >
          Choose another file
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Column mapping</CardTitle>
          <CardDescription>
            Auto-detected — adjust if your bank&apos;s headers differ.{" "}
            {missingRequired.length > 0 ? (
              <span className="font-medium text-destructive">
                Missing: {missingRequired.map((f) => FIELDS.find((x) => x.key === f)!.label).join(", ")}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label>
                {f.label}
                {REQUIRED.includes(f.key) ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Select
                value={mapping[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
              >
                <option value="">— not imported —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>First 10 rows</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Merchant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapped.slice(0, 10).map((r) => (
                <TableRow key={r.index}>
                  <TableCell>
                    {r.errors.length === 0 ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-destructive">
                        <XCircle className="size-4" />
                        {r.errors.join(", ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.dateISO ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.amountPaise !== null ? `₹${(r.amountPaise / 100).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {knownCategories.some(
                        (k) => k.toLowerCase() === r.categoryName.toLowerCase()
                      ) ? null : (
                        <Badge variant="secondary">new</Badge>
                      )}
                      {r.categoryName}
                    </span>
                  </TableCell>
                  <TableCell>{r.paymentMethod}</TableCell>
                  <TableCell>{r.merchant || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={invalidCount === rows.length}
          onClick={() =>
            handleImport({ createMissingCategories: false, skipDuplicates: true })
          }
        >
          Import valid rows (skip unknown categories)
        </Button>
        <Button
          disabled={missingRequired.length > 0 || invalidCount === rows.length}
          onClick={() =>
            handleImport({ createMissingCategories: true, skipDuplicates: true })
          }
        >
          Import & create missing categories
        </Button>
      </div>
    </div>
  );
}
