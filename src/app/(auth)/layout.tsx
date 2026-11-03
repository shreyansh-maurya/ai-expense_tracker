import type { ReactNode } from "react";
import { IndianRupee } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <IndianRupee className="size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">AI Expense Tracker</p>
            <p className="text-xs text-muted-foreground">Your spending, private to your account</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
