import {
  FileSpreadsheet,
  Gift,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Repeat,
  Tags,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/expenses", label: "Expenses", icon: ReceiptText, exact: true },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/recurring", label: "Recurring", icon: Repeat, exact: true },
  { href: "/wishlist", label: "Wishlist", icon: Gift },
  { href: "/settings/categories", label: "Categories", icon: Tags },
  { href: "/expenses/import", label: "Import CSV", icon: FileSpreadsheet },
];
