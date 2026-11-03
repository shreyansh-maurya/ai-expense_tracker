import { listCategories } from "@/lib/services/categories";
import { requireUser } from "@/lib/auth";
import { CategoryManager } from "@/components/categories/category-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organize expenses by category — colors show up across charts and tables
        </p>
      </div>
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          keywords: c.keywords,
          isArchived: c.isArchived,
          expenseCount: c._count.expenses,
        }))}
      />
    </div>
  );
}
