import type { ReactNode } from "react";
import { IndianRupee } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IndianRupee className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">AI Expense Tracker</p>
            <p className="text-xs text-muted-foreground">Local · INR</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav />
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-xs text-muted-foreground">v0.1 · Phase A</p>
          <ThemeToggle />
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IndianRupee className="size-4" />
            </div>
            <span className="text-sm font-semibold">AI Expense Tracker</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
