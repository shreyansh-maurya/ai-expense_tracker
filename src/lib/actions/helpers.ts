import type { z } from "zod";
import { ServiceError } from "@/lib/services/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };

export function zodFirstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function toErrorMessage(e: unknown): string {
  if (e instanceof ServiceError) return e.message;
  console.error(e);
  return "Something went wrong. Please try again.";
}
