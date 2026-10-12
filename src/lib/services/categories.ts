import { prisma } from "@/lib/db";
import { ServiceError } from "./errors";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    include: { _count: { select: { expenses: true } } },
  });
}

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(input: { name: string; color: string; keywords?: string }) {
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) throw new ServiceError(`A category named "${input.name}" already exists`);
  return prisma.category.create({
    data: { name: input.name, color: input.color, keywords: input.keywords || null },
  });
}

export async function updateCategory(
  id: string,
  input: { name: string; color: string; keywords?: string }
) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Category not found");
  const clash = await prisma.category.findUnique({ where: { name: input.name } });
  if (clash && clash.id !== id) throw new ServiceError(`A category named "${input.name}" already exists`);
  return prisma.category.update({
    where: { id },
    data: { name: input.name, color: input.color, keywords: input.keywords || null },
  });
}

export async function setCategoryArchived(id: string, archived: boolean) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Category not found");
  return prisma.category.update({ where: { id }, data: { isArchived: archived } });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Category not found");
  const count = await prisma.expense.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new ServiceError(
      `This category is used by ${count} expense${count === 1 ? "" : "s"} — archive it instead.`
    );
  }
  await prisma.category.delete({ where: { id } }); // budgets cascade via schema
}
