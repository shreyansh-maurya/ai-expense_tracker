"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { loginAction, registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [pending, setPending] = React.useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      ...(isRegister ? { name: String(form.get("name") ?? "") } : {}),
    };
    setPending(true);
    const res = isRegister ? await registerAction(payload) : await loginAction(payload);
    // A successful action redirects, so anything returned here is a failure.
    if (!res.ok) {
      toast.error(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isRegister ? (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name (optional)</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Your name" />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "At least 8 characters" : "Your password"}
        />
      </div>

      <Button type="submit" className="w-full gap-2" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isRegister ? (
          <UserPlus className="size-4" />
        ) : (
          <LogIn className="size-4" />
        )}
        {isRegister ? "Create account" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
