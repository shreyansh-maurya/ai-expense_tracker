import Link from "next/link";
import { listCategories } from "@/lib/services/categories";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import CSV" };

export default async function ImportPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import expenses</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV export from your bank — dates accept DD/MM/YYYY and YYYY-MM-DD
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/api/expenses/export?template=1">Download template</Link>
        </Button>
      </div>
      <ImportWizard knownCategories={categories.filter((c) => !c.isArchived).map((c) => c.name)} />
    </div>
  );
}
