"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveCategoryAction,
  setCategoryArchivedAction,
  deleteCategoryAction,
} from "@/lib/actions/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  keywords: string | null;
  isArchived: boolean;
  expenseCount: number;
};

function CategoryDialog({
  initial,
  trigger,
}: {
  initial?: CategoryRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [color, setColor] = React.useState(initial?.color ?? "#6366f1");
  const [keywords, setKeywords] = React.useState(initial?.keywords ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await saveCategoryAction({ name, color, keywords: keywords ?? "" }, initial?.id);
      if (res.ok) {
        toast.success(initial ? "Category updated" : "Category created");
        setOpen(false);
        if (!initial) {
          setName("");
          setColor("#6366f1");
          setKeywords("");
        }
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              required
              maxLength={40}
              placeholder="e.g. Groceries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-color">Color</Label>
            <div className="flex items-center gap-3">
              <input
                id="cat-color"
                type="color"
                className="size-9 cursor-pointer rounded-md border bg-transparent"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <Input
                className="mono w-32 tabular-nums"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-keywords">Keywords (comma-separated, for auto-categorization)</Label>
            <Textarea
              id="cat-keywords"
              placeholder="e.g. swiggy, zomato, restaurant"
              maxLength={500}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.filter((c) => !c.isArchived).length} active ·{" "}
          {categories.filter((c) => c.isArchived).length} archived
        </p>
        <CategoryDialog
          trigger={
            <Button size="sm">
              <Plus />
              New category
            </Button>
          }
        />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="hidden sm:table-cell">Keywords</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id} className={c.isArchived ? "opacity-50" : undefined}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium">{c.name}</span>
                    {c.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-64 truncate text-muted-foreground sm:table-cell">
                  {c.keywords || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.expenseCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <CategoryDialog
                      initial={c}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={c.isArchived ? `Restore ${c.name}` : `Archive ${c.name}`}
                      onClick={async () => {
                        const res = await setCategoryArchivedAction(c.id, !c.isArchived);
                        res.ok
                          ? toast.success(c.isArchived ? "Category restored" : "Category archived")
                          : toast.error(res.error);
                      }}
                    >
                      {c.isArchived ? <ArchiveRestore /> : <Archive />}
                    </Button>
                    {c.expenseCount === 0 ? (
                      <ConfirmDialog
                        title={`Delete "${c.name}"?`}
                        description="This also removes any budgets set for it."
                        onConfirm={() => deleteCategoryAction(c.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${c.name}`}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        }
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        aria-label={`Delete ${c.name}`}
                        title="Expenses exist — archive instead"
                      >
                        <Trash2 className="text-muted-foreground opacity-40" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
