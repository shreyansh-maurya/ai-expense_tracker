"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ email }: { email: string }) {
  return (
    <form action={logoutAction} className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" title={email}>
          {email}
        </p>
        <p className="text-[11px] text-muted-foreground">Signed in</p>
      </div>
      <Button type="submit" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
        <LogOut className="size-3.5" />
        Sign out
      </Button>
    </form>
  );
}
