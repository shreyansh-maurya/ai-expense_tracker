"use server";

import { revalidatePath } from "next/cache";
import { categoryInputSchema } from "@/lib/validators/category";
import {
  createCategory,
  deleteCategory,
  setCategoryArchived,
  updateCategory,
} from "@/lib/services/categories";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
  revalidatePath("/settings/categories");
}

export async function saveCategoryAction(input: unknown, id?: string): Promise<ActionResult> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  try {
    if (id) await updateCategory(id, parsed.data);
    else await createCategory(parsed.data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function setCategoryArchivedAction(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  try {
    await setCategoryArchived(id, archived);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await deleteCategory(id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}
