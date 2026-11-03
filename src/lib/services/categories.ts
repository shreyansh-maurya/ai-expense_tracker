import { prisma } from "@/lib/db";
import { ServiceError } from "./errors";

export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    include: { _count: { select: { expenses: true } } },
  });
}

export async function listActiveCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, isArchived: false },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(
  userId: string,
  input: { name: string; color: string; keywords?: string }
) {
  const existing = await prisma.category.findFirst({ where: { userId, name: input.name } });
  if (existing) throw new ServiceError(`A category named "${input.name}" already exists`);
  return prisma.category.create({
    data: { userId, name: input.name, color: input.color, keywords: input.keywords || null },
  });
}

export async function updateCategory(
  userId: string,
  id: string,
  input: { name: string; color: string; keywords?: string }
) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) throw new ServiceError("Category not found");
  const clash = await prisma.category.findFirst({ where: { userId, name: input.name } });
  if (clash && clash.id !== id) throw new ServiceError(`A category named "${input.name}" already exists`);
  return prisma.category.update({
    where: { id },
    data: { name: input.name, color: input.color, keywords: input.keywords || null },
  });
}

export async function setCategoryArchived(userId: string, id: string, archived: boolean) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) throw new ServiceError("Category not found");
  return prisma.category.update({ where: { id }, data: { isArchived: archived } });
}

export async function deleteCategory(userId: string, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) throw new ServiceError("Category not found");
  const count = await prisma.expense.count({ where: { categoryId: id, userId } });
  if (count > 0) {
    throw new ServiceError(
      `This category is used by ${count} expense${count === 1 ? "" : "s"} — archive it instead.`
    );
  }
  const recurring = await prisma.recurringExpense.count({ where: { categoryId: id, userId } });
  if (recurring > 0) {
    throw new ServiceError(
      `This category is used by ${recurring} recurring expense${recurring === 1 ? "" : "s"} — archive it instead.`
    );
  }
  await prisma.category.delete({ where: { id } }); // budgets cascade via schema
}
