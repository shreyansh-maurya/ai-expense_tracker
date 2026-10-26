import { z } from "zod";
import { expenseInputSchema } from "@/lib/validators/expense";
import {
  detectStoreFromUrl,
  WISHLIST_STORES,
  WISHLIST_STORE_LABELS,
} from "@/lib/wishlist-stores";

export { WISHLIST_STORES, WISHLIST_STORE_LABELS, detectStoreFromUrl };
export type { WishlistStore } from "@/lib/wishlist-stores";
export type { ExpenseInput } from "@/lib/validators/expense";

export const WISHLIST_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export const WISHLIST_STATUSES = ["WANTED", "ORDERED", "BOUGHT", "DROPPED"] as const;
export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];

const emptyToUndef = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v;

const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: `Enter a valid ${label} link starting with http(s)://` }
    );

export const wishlistInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the item a name")
    .max(140, "Keep the name under 140 characters"),
  url: z.preprocess(emptyToUndef, httpUrl("product").optional()),
  store: z.preprocess(emptyToUndef, z.enum(WISHLIST_STORES).optional()),
  price: z.preprocess(emptyToUndef, z.string().optional()),
  imageUrl: z.preprocess(emptyToUndef, httpUrl("image").optional()),
  priority: z.preprocess(emptyToUndef, z.enum(WISHLIST_PRIORITIES).optional().default("MEDIUM")),
  notes: z.preprocess(
    emptyToUndef,
    z.string().trim().max(1000, "Keep notes under 1000 characters").optional().default("")
  ),
});

export const wishlistStatusSchema = z.enum(WISHLIST_STATUSES, {
  errorMap: () => ({ message: "Unknown wishlist status" }),
});

export type WishlistInput = z.infer<typeof wishlistInputSchema>;

/** "Mark bought" logs a real expense using the exact same contract as the expense form. */
export const boughtExpenseSchema = expenseInputSchema;
