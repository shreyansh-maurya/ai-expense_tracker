import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Name is too long"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  keywords: z.string().trim().max(500).optional().default(""),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;
