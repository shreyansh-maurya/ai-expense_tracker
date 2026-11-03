"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession, signIn, signUp } from "@/lib/auth";
import { toErrorMessage } from "./helpers";

export type AuthActionResponse = { ok: true } | { ok: false; error: string };

const email = z.string().trim().min(1, "Enter your email").email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters");

const registerSchema = z.object({
  name: z.string().trim().max(60).optional(),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export async function registerAction(input: unknown): Promise<AuthActionResponse> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await signUp(parsed.data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  redirect("/");
}

export async function loginAction(input: unknown): Promise<AuthActionResponse> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await signIn(parsed.data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
