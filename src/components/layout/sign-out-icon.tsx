"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/** Compact sign-out for the mobile header, where the sidebar is hidden. */
export function SignOutIcon() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </Button>
    </form>
  );
}
